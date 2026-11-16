#import "GroupPlayerSource.hpp"
#include "SourceClockTicks.hpp"
#import <QuartzCore/QuartzCore.h>
#include <algorithm>
#include <cmath>

@implementation STGroupPlayerSource {
  STApplePlayerSession *_player;
  STSourceSampleIntervals *_index;
  std::optional<appleplayback::FrameBudget> _budget;
  std::optional<appleplayback::RetainedImage<appleplayback::GroupPixel>> _pending;
  std::optional<appleplayback::GroupSourceFrame> _frame;
  uint64_t _start, _end, _operation, _target, _pendingDisplayTime;
  NSUInteger _activeSeeks, _seekRevision;
  int64_t _offset;
  double _deadline;
  BOOL _closed, _failed, _seekStarted, _seekCompleted, _initialReady;
  NSError *_failure;
}
- (instancetype)initWithURL:(NSURL *)url globalStart:(uint64_t)start
                 globalEnd:(uint64_t)end sourceOffset:(int64_t)offset
                    budget:(appleplayback::FrameBudget)budget {
  NSParameterAssert(NSThread.isMainThread);
  NSParameterAssert(url.isFileURL && start < end && end <= 86400ULL * 120000 &&
    offset >= -int64_t(86400ULL * 120000) && offset <= int64_t(86400ULL * 120000) &&
    int64_t(start) + offset >= 0 && int64_t(end) + offset <= int64_t(86400ULL * 120000));
  if ((self = [super init])) {
    _budget.emplace(std::move(budget)); _start = start; _end = end; _offset = offset;
    _player = [[STApplePlayerSession alloc] initWithURL:url];
    _index = [[STSourceSampleIntervals alloc] initWithURL:url];
  }
  return self;
}
- (void)fail:(NSInteger)code underlying:(NSError *)underlying {
  if (_failed || _closed) return;
  _failed = YES;
  _failure = [NSError errorWithDomain:@"SportagGroupSource" code:code
    userInfo:underlying ? @{NSUnderlyingErrorKey:underlying} : @{}];
  [_player pause]; _pending.reset(); _frame.reset(); [_index cancel];
}
- (BOOL)seek:(uint64_t)ticks operation:(uint64_t)operation {
  NSParameterAssert(NSThread.isMainThread);
  if (_closed || _failed || !operation || operation <= _operation || ticks < _start || ticks >= _end) return NO;
  [_player pause]; _pending.reset(); _frame.reset();
  ++_seekRevision;
  _operation = operation; _target = ticks; _seekStarted = NO; _seekCompleted = NO; _initialReady = NO;
  _deadline = CACurrentMediaTime() + 10;
  return YES;
}
- (BOOL)adoptOperation:(uint64_t)operation {
  NSParameterAssert(NSThread.isMainThread);
  if (_closed || _failed || !_operation || operation <= _operation || operation > 9007199254740991ULL) return NO;
  _operation = operation; return YES;
}
- (void)poll {
  NSParameterAssert(NSThread.isMainThread);
  if (_closed || _failed || !_operation) return;
  if (_player.status == AVPlayerItemStatusFailed) { [self fail:1 underlying:_player.error]; return; }
  if (_index.failed) {
    [self fail:2 underlying:[NSError errorWithDomain:@"SportagSampleMetadata" code:(NSInteger)_index.failure userInfo:@{@"displayTime":@(_pendingDisplayTime)}]];
    return;
  }
  if (!_initialReady && CACurrentMediaTime() >= _deadline) { [self fail:3 underlying:nil]; return; }
  if (_player.status != AVPlayerItemStatusReadyToPlay) return;
  if (!_seekStarted) {
    _seekStarted = YES;
    const NSUInteger revision = _seekRevision;
    __weak STGroupPlayerSource *weakSelf = self;
    ++_activeSeeks;
    [_player seekToTime:CMTimeMake(int64_t(_target) + _offset, 120000) approximate:NO completion:^(BOOL finished) {
      STGroupPlayerSource *source = weakSelf;
      if (!source) return;
      NSCAssert(source->_activeSeeks > 0, @"group source seek accounting");
      --source->_activeSeeks;
      if (source->_closed || source->_failed || revision != source->_seekRevision) return;
      if (!finished) [source fail:4 underlying:nil];
      else source->_seekCompleted = YES;
    }];
    return;
  }
  if (!_seekCompleted) return;
  if (!_pending) {
    CMTime pts = kCMTimeInvalid;
    CVPixelBufferRef value = [_player copyCurrentImage:&pts force:!_initialReady];
    if (!value) return;
    auto owner = appleplayback::OwnedImage<appleplayback::GroupPixel>(value,
      [](appleplayback::GroupPixel *image) { CVPixelBufferRelease(image); });
    auto time = appleplayback::sourceTicks(pts);
    if (!time) { [self fail:5 underlying:nil]; return; }
    // Even an image waiting for its metadata must have a shared budget charge.
    _pending = _budget->retainImage(std::move(owner), CVPixelBufferGetDataSize(value));
    if (!_pending) { [self fail:6 underlying:nil]; return; }
    _pendingDisplayTime = *time;
  }
  auto interval = [_index lookup:_pendingDisplayTime];
  if (!interval) { [_index request:_pendingDisplayTime]; return; }
  const int64_t mappedStart = int64_t(interval->start) - _offset;
  const int64_t mappedEnd = int64_t(interval->end) - _offset;
  const int64_t start = std::max<int64_t>(mappedStart, _start), end = std::min<int64_t>(mappedEnd, _end);
  if (start < 0 || start >= end) { _pending.reset(); return; }
  _frame = appleplayback::GroupSourceFrame{*_pending, interval->start, interval->end,
    uint64_t(start), uint64_t(end)};
  _pending.reset();
  if (_frame->covers(_target)) _initialReady = YES;
}
- (std::optional<appleplayback::GroupSourceFrame>)frame {
  NSParameterAssert(NSThread.isMainThread);
  return _closed || _failed ? std::nullopt : _frame;
}
- (BOOL)scheduleRate:(float)rate globalTicks:(uint64_t)ticks hostTime:(CMTime)hostTime {
  NSParameterAssert(NSThread.isMainThread);
  if (_closed || _failed || !_seekCompleted || !_frame || !_frame->covers(ticks)) return NO;
  return [_player scheduleRate:rate fromTime:CMTimeMake(int64_t(ticks) + _offset, 120000) atHostTime:hostTime];
}
- (BOOL)selectAudioTrack:(NSUInteger)track volume:(float)volume muted:(BOOL)muted {
  NSParameterAssert(NSThread.isMainThread);
  if (_closed || _failed || _player.status != AVPlayerItemStatusReadyToPlay || !std::isfinite(volume) || volume < 0 || volume > 1) return NO;
  // A silent source may own a silent angle. No automatic alternate audio owner.
  if (_player.audioTrackCount && ![_player selectAudioTrack:track]) return NO;
  if (!_player.audioTrackCount && track) return NO;
  [_player setVolume:volume muted:muted]; return YES;
}
- (std::optional<float>)observedRate {
  NSParameterAssert(NSThread.isMainThread);
  const float rate = _player.rate;
  return _closed || _failed || !std::isfinite(rate) ? std::nullopt : std::optional<float>(rate);
}
- (void)silence { NSParameterAssert(NSThread.isMainThread); [_player setVolume:0 muted:YES]; }
- (void)pause { NSParameterAssert(NSThread.isMainThread); [_player pause]; }
- (void)close {
  NSParameterAssert(NSThread.isMainThread);
  if (_closed) return;
  _closed = YES; _pending.reset(); _frame.reset(); [_index cancel]; [_player close];
}
- (BOOL)failed { return _failed; }
- (BOOL)drained { return _closed && !_activeSeeks && _index.drained; }
- (BOOL)seekCompleted { return !_closed && !_failed && _seekCompleted; }
- (NSError *)error { return _failure ?: _player.error; }
@end
