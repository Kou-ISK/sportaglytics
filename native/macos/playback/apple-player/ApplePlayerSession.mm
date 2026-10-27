#import "ApplePlayerSession.hpp"
#import <QuartzCore/QuartzCore.h>

@implementation STApplePlayerSession {
  AVPlayer *_player;
  AVPlayerItem *_item;
  AVPlayerItemVideoOutput *_output;
  NSUInteger _seekRevision;
  BOOL _closed;
}
- (instancetype)initWithURL:(NSURL *)url {
  NSParameterAssert(NSThread.isMainThread);
  NSParameterAssert(url.isFileURL);
  if ((self = [super init])) {
    _item = [AVPlayerItem playerItemWithURL:url];
    _output = [[AVPlayerItemVideoOutput alloc] initWithPixelBufferAttributes:@{
      (id)kCVPixelBufferPixelFormatTypeKey: @(kCVPixelFormatType_420YpCbCr8BiPlanarVideoRange),
      (id)kCVPixelBufferIOSurfacePropertiesKey: @{}
    }];
    _output.suppressesPlayerRendering = YES;
    [_item addOutput:_output];
    _player = [AVPlayer playerWithPlayerItem:_item];
    // Setup is silent; Main supplies the existing user's audio selection before play.
    _player.muted = YES;
  }
  return self;
}
- (AVPlayerItemStatus)status { return _item.status; }
- (NSError *)error { return _item.error ?: _player.error; }
- (CMTime)duration { return _item.duration; }
- (CMTime)currentTime { return _player.currentTime; }
- (float)rate { return _item.timebase ? CMTimebaseGetRate(_item.timebase) : 0; }
- (AVPlayerTimeControlStatus)timeControlStatus { return _player.timeControlStatus; }
- (NSArray<AVPlayerItemTrack *> *)audioTracks {
  NSMutableArray<AVPlayerItemTrack *> *tracks = [NSMutableArray array];
  for (AVPlayerItemTrack *track in _item.tracks) {
    if ([track.assetTrack.mediaType isEqualToString:AVMediaTypeAudio]) [tracks addObject:track];
  }
  return tracks;
}
- (NSUInteger)audioTrackCount { return self.audioTracks.count; }
- (BOOL)supportsRate:(float)rate {
  if (_closed || _item.status != AVPlayerItemStatusReadyToPlay) return NO;
  if (rate >= 1 && rate <= 2) return YES;
  return rate > 2 ? _item.canPlayFastForward : rate > 0 && _item.canPlaySlowForward;
}
- (BOOL)selectAudioTrack:(NSUInteger)index {
  NSParameterAssert(NSThread.isMainThread);
  NSArray<AVPlayerItemTrack *> *tracks = self.audioTracks;
  if (_closed || index >= tracks.count) return NO;
  for (NSUInteger current = 0; current < tracks.count; current++) {
    BOOL enabled = current == index;
    if (tracks[current].enabled != enabled) tracks[current].enabled = enabled;
  }
  return YES;
}
- (void)setVolume:(float)volume muted:(BOOL)muted {
  NSParameterAssert(NSThread.isMainThread);
  if (_closed) return;
  _player.volume = volume;
  _player.muted = muted;
}
- (void)setRate:(float)rate {
  NSParameterAssert(NSThread.isMainThread);
  if (!_closed && _player.rate != rate) _player.rate = rate;
}
- (void)pause {
  NSParameterAssert(NSThread.isMainThread);
  [_player pause];
}
- (void)seekToTime:(CMTime)time approximate:(BOOL)approximate
        completion:(void (^)(BOOL))completion {
  NSParameterAssert(NSThread.isMainThread);
  if (_closed) { completion(NO); return; }
  NSUInteger revision = ++_seekRevision;
  CMTime tolerance = approximate ? kCMTimePositiveInfinity : kCMTimeZero;
  __weak STApplePlayerSession *weakSelf = self;
  [_player seekToTime:time toleranceBefore:tolerance toleranceAfter:tolerance
    completionHandler:^(BOOL finished) {
      dispatch_async(dispatch_get_main_queue(), ^{
        STApplePlayerSession *session = weakSelf;
        completion(finished && session && !session->_closed && revision == session->_seekRevision);
      });
    }];
}
- (CVPixelBufferRef)copyCurrentImage:(CMTime *)presentationTime force:(BOOL)force {
  NSParameterAssert(NSThread.isMainThread);
  if (_closed) return NULL;
  CMTime time = _player.rate == 0 ? _player.currentTime : [_output itemTimeForHostTime:CACurrentMediaTime()];
  if (!CMTIME_IS_NUMERIC(time) || (!force && ![_output hasNewPixelBufferForItemTime:time])) return NULL;
  return [_output copyPixelBufferForItemTime:time itemTimeForDisplay:presentationTime];
}
- (void)close {
  NSParameterAssert(NSThread.isMainThread);
  if (_closed) return;
  _closed = YES;
  ++_seekRevision;
  [_player pause];
  [_item cancelPendingSeeks];
  [_player replaceCurrentItemWithPlayerItem:nil];
  [_item removeOutput:_output];
}
@end
