#import "ApplePlayerSession.hpp"
#import <QuartzCore/QuartzCore.h>
#include <cmath>

namespace {
AVPlayerItemVideoOutput *makeVideoOutput() {
  AVPlayerItemVideoOutput *output = [[AVPlayerItemVideoOutput alloc] initWithPixelBufferAttributes:@{
    (id)kCVPixelBufferPixelFormatTypeKey: @(kCVPixelFormatType_420YpCbCr8BiPlanarVideoRange),
    (id)kCVPixelBufferIOSurfacePropertiesKey: @{}
  }];
  output.suppressesPlayerRendering = YES;
  return output;
}
}

@implementation STApplePlayerSession {
  AVPlayer *_player;
  AVPlayerItem *_item;
  AVPlayerItemVideoOutput *_output;
  NSUInteger _seekRevision;
  BOOL _closed;
  BOOL _seeking;
}
- (instancetype)initWithURL:(NSURL *)url {
  NSParameterAssert(NSThread.isMainThread);
  NSParameterAssert(url.isFileURL);
  if ((self = [super init])) {
    _item = [AVPlayerItem playerItemWithURL:url];
    _output = makeVideoOutput();
    [_item addOutput:_output];
    _player = [AVPlayer playerWithPlayerItem:_item];
    _item.reversePlaybackEndTime = kCMTimeZero;
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
  if (rate == -0.5) return _item.canPlaySlowReverse;
  if (rate == -2 || rate == -4 || rate == -6) return _item.canPlayFastReverse;
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
- (BOOL)scheduleRate:(float)rate fromTime:(CMTime)time atHostTime:(CMTime)hostTime {
  NSParameterAssert(NSThread.isMainThread);
  if (_closed || _seeking || !std::isfinite(rate) || ![self supportsRate:rate] ||
      !CMTIME_IS_NUMERIC(time) || !CMTIME_IS_NUMERIC(hostTime) ||
      !CMTIME_IS_NUMERIC(self.duration) || CMTimeCompare(time, kCMTimeZero) < 0 ||
      CMTimeCompare(time, self.duration) > 0 ||
      CMTimeCompare(hostTime, CMClockGetTime(CMClockGetHostTimeClock())) <= 0) return NO;
  // Required by AVPlayer's external host-clock scheduling contract. Readiness
  // above is not a promise of uninterrupted data supply; the group monitors it.
  _player.automaticallyWaitsToMinimizeStalling = NO;
  [_player setRate:rate time:time atHostTime:hostTime];
  return YES;
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
  _seeking = YES;
  CMTime tolerance = approximate ? kCMTimePositiveInfinity : kCMTimeZero;
  __weak STApplePlayerSession *weakSelf = self;
  [_player seekToTime:time toleranceBefore:tolerance toleranceAfter:tolerance
    completionHandler:^(BOOL finished) {
      dispatch_async(dispatch_get_main_queue(), ^{
        STApplePlayerSession *session = weakSelf;
        if (session && revision == session->_seekRevision) session->_seeking = NO;
        completion(finished && session && !session->_closed && revision == session->_seekRevision);
      });
    }];
}
- (void)settleStoppedImageAtTime:(CMTime)time completion:(void (^)(BOOL))completion {
  NSParameterAssert(NSThread.isMainThread);
  if (_closed || _seeking || self.rate != 0 || !CMTIME_IS_NUMERIC(time) ||
      CMTimeCompare(time, kCMTimeZero) < 0 || !CMTIME_IS_NUMERIC(self.duration) ||
      CMTimeCompare(time, self.duration) >= 0) {
    completion(NO); return;
  }
  // A completed reverse seek can leave old images in AVPlayerItemVideoOutput.
  // Already transferred CVPixelBuffers remain owned by their surface leases;
  // replacing this output does not release those buffers or alter audio tracks.
  [_item removeOutput:_output];
  _output = makeVideoOutput();
  [_item addOutput:_output];
  [self seekToTime:time approximate:NO completion:completion];
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
  _seeking = NO;
  ++_seekRevision;
  [_player pause];
  [_item cancelPendingSeeks];
  [_player replaceCurrentItemWithPlayerItem:nil];
  [_item removeOutput:_output];
}
@end
