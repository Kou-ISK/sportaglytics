#import "GroupPlayerSource.hpp"
#include "SourceClockTicks.hpp"
#include "GroupDecodeWindow.hpp"
#import <QuartzCore/QuartzCore.h>
#include <algorithm>
#include <cmath>
#include <array>

static_assert(std::is_nothrow_copy_constructible_v<appleplayback::GroupSourceFrame>,
  "post-publication image pins must not allocate during copy");

@implementation STGroupPlayerSource {
  STApplePlayerSession *_player;
  STDecodedFrameWindow *_decoder;
  std::optional<appleplayback::FrameBudget> _budget;
  std::optional<appleplayback::GroupSourceFrame> _frame, _confirmedStopFrame;
  struct PublishedFrame { uint64_t pair; appleplayback::GroupSourceFrame frame; };
  std::array<std::optional<PublishedFrame>, 4> _publishedFrames;
  size_t _publishedCursor;
  uint64_t _start, _end, _operation, _target, _windowStart, _windowEnd;
  NSUInteger _activeSeeks, _seekRevision;
  int64_t _offset;
  double _deadline;
  float _supplyRate;
  BOOL _closed, _failed, _seekStarted, _seekCompleted, _initialReady, _windowRequested, _audioConfigured, _audioAbsent;
  NSError *_failure;
}
- (instancetype)initWithURL:(NSURL *)url globalStart:(uint64_t)start
                 globalEnd:(uint64_t)end sourceOffset:(int64_t)offset
                    budget:(appleplayback::FrameBudget)budget sourceRevision:(std::string)revision {
  // Validate before constructing AVFoundation's owned session, not only in
  // the delegated initializer after its argument has already been evaluated.
  NSParameterAssert(NSThread.isMainThread && url.isFileURL && start < end &&
    end <= 86400ULL * 120000 && offset >= -int64_t(86400ULL * 120000) &&
    offset <= int64_t(86400ULL * 120000) && int64_t(start) + offset >= 0 &&
    int64_t(end) + offset <= int64_t(86400ULL * 120000));
  return [self initWithURL:url globalStart:start globalEnd:end sourceOffset:offset
    budget:std::move(budget) sourceRevision:std::move(revision)
    audioSession:[[STApplePlayerSession alloc] initWithURL:url]];
}
- (instancetype)initWithURL:(NSURL *)url globalStart:(uint64_t)start
                 globalEnd:(uint64_t)end sourceOffset:(int64_t)offset
                    budget:(appleplayback::FrameBudget)budget sourceRevision:(std::string)revision
              audioSession:(STApplePlayerSession *)audio {
  NSParameterAssert(NSThread.isMainThread);
  NSParameterAssert(audio != nil);
  NSParameterAssert(url.isFileURL && start < end && end <= 86400ULL * 120000 &&
    offset >= -int64_t(86400ULL * 120000) && offset <= int64_t(86400ULL * 120000) &&
    int64_t(start) + offset >= 0 && int64_t(end) + offset <= int64_t(86400ULL * 120000));
  if ((self = [super init])) {
    _budget.emplace(std::move(budget)); _start = start; _end = end; _offset = offset;
    _player = audio;
    _decoder = [[STDecodedFrameWindow alloc] initWithURL:url budget:*_budget sourceRevision:std::move(revision)];
  }
  return self;
}
- (void)fail:(NSInteger)code underlying:(NSError *)underlying {
  if (_failed || _closed) return;
  _failed = YES;
  _failure = [NSError errorWithDomain:@"SportagGroupSource" code:code
    userInfo:underlying ? @{NSUnderlyingErrorKey:underlying} : @{}];
  [_player pause]; _frame.reset(); _confirmedStopFrame.reset(); _publishedFrames = {}; _publishedCursor = 0; [_decoder close];
}
- (BOOL)seek:(uint64_t)ticks operation:(uint64_t)operation {
  NSParameterAssert(NSThread.isMainThread);
  if (_closed || _failed || !operation || operation <= _operation || ticks < _start || ticks >= _end) return NO;
  [_player pause]; _supplyRate = 0; _frame.reset(); _confirmedStopFrame.reset(); _publishedFrames = {}; _publishedCursor = 0;
  [_decoder invalidate]; _windowRequested = NO;
  ++_seekRevision;
  _operation = operation; _target = ticks; _seekStarted = NO; _seekCompleted = NO; _initialReady = NO;
  _deadline = CACurrentMediaTime() + 10;
  return YES;
}
- (BOOL)rememberPublishedPair:(uint64_t)pair {
  NSParameterAssert(NSThread.isMainThread);
  if (_closed || _failed || !_frame || !pair || pair > 9007199254740991ULL ||
      std::any_of(_publishedFrames.begin(), _publishedFrames.end(), [pair](const auto &pin) {
        return pin && pair <= pin->pair;
      })) return NO;
  // Fixed slots avoid allocating after the complete pair has already been
  // sent. Shared loans retain their existing charge; no pixels are copied.
  _publishedFrames[_publishedCursor].emplace(PublishedFrame{pair, *_frame});
  _publishedCursor = (_publishedCursor + 1) % _publishedFrames.size();
  return YES;
}
- (BOOL)hasPublishedPair:(uint64_t)pair covering:(uint64_t)ticks {
  NSParameterAssert(NSThread.isMainThread);
  if (_closed || _failed || !pair || pair > 9007199254740991ULL || ticks < _start || ticks >= _end) return NO;
  if (![_decoder sourceCurrent]) { [self fail:2 underlying:_decoder.error]; return NO; }
  return std::any_of(_publishedFrames.begin(), _publishedFrames.end(), [pair, ticks](const auto &pin) {
    return pin && pin->pair == pair && pin->frame.covers(ticks);
  });
}
- (BOOL)seek:(uint64_t)ticks operation:(uint64_t)operation publishedPair:(uint64_t)pair {
  NSParameterAssert(NSThread.isMainThread);
  if (![self hasPublishedPair:pair covering:ticks]) return NO;
  auto found = std::find_if(_publishedFrames.begin(), _publishedFrames.end(),
    [pair](const auto &pin) { return pin && pin->pair == pair; });
  const auto stopped = found->value().frame;
  if (![self seek:ticks operation:operation]) return NO;
  _confirmedStopFrame = stopped;
  return YES;
}
- (BOOL)adoptOperation:(uint64_t)operation {
  NSParameterAssert(NSThread.isMainThread);
  if (_closed || _failed || !_operation || operation <= _operation || operation > 9007199254740991ULL) return NO;
  _operation = operation; return YES;
}
- (void)poll { [self pollAtGlobalTime:_target]; }
- (void)pollAtGlobalTime:(uint64_t)wanted {
  NSParameterAssert(NSThread.isMainThread);
  if (_closed || _failed || !_operation) return;
  if (!_audioAbsent && _player.status == AVPlayerItemStatusFailed) { [self fail:1 underlying:_player.error]; return; }
  if (wanted < _start || wanted >= _end) { [self fail:5 underlying:nil]; return; }
  if (_decoder.failed) { [self fail:2 underlying:_decoder.error]; return; }
  if (!_initialReady && CACurrentMediaTime() >= _deadline) { [self fail:3 underlying:nil]; return; }
  // Prepare timestamped pixels independently of AVPlayer loading/positioning.
  // No image becomes a ready group member before the audio barrier below.
  const uint64_t query = uint64_t(int64_t(wanted) + _offset);
  auto frame = [_decoder select:query];
  if (_decoder.failed) { [self fail:2 underlying:_decoder.error]; return; }
  const auto stopped = _confirmedStopFrame && _confirmedStopFrame->covers(wanted) ?
    _confirmedStopFrame : std::nullopt;
  if (!frame && !stopped) {
    if (_decoder.failed) { [self fail:2 underlying:_decoder.error]; return; }
    if (_decoder.drained) {
      if (_windowRequested && query >= _windowStart && query < _windowEnd) {
        [self fail:2 underlying:[NSError errorWithDomain:@"SportagDecodeWindow" code:8 userInfo:nil]];
        return; // known completed gap cannot trigger an unbounded retry
      }
      const uint64_t sourceEnd = uint64_t(int64_t(_end) + _offset);
      _windowStart = std::max<uint64_t>(uint64_t(int64_t(_start) + _offset), query > 30000 ? query - 30000 : 0);
      _windowEnd = std::min(sourceEnd, query + 30000);
      _windowRequested = [_decoder requestStart:_windowStart end:_windowEnd];
      if (!_windowRequested) [self fail:2 underlying:_decoder.error];
    }
  }
  if (_failed) return;
  if (!_audioAbsent && _player.status != AVPlayerItemStatusReadyToPlay) return;
  if (!_audioConfigured) {
    _audioAbsent = _player.audioTrackCount == 0;
    if (![_player prepareAudioOnly]) { [self fail:1 underlying:_player.error]; return; }
    _audioConfigured = YES;
  }
  if (_audioAbsent) { _seekStarted = YES; _seekCompleted = YES; }
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
  }
  if (!_seekCompleted || (!frame && !stopped)) return;
  if (stopped) {
    _frame = stopped;
    if (_frame->covers(_target)) _initialReady = YES;
    return; // no new decode or fabricated audio readiness for a proven stop
  }
  const uint64_t sourceStart = uint64_t(llround(frame->pts() * 120000));
  const uint64_t sourceEnd = uint64_t(llround(frame->end() * 120000));
  const int64_t start = std::max<int64_t>(int64_t(sourceStart) - _offset, _start);
  const int64_t end = std::min<int64_t>(int64_t(sourceEnd) - _offset, _end);
  if (start < 0 || start >= end) { [self fail:5 underlying:nil]; return; }
  _frame = appleplayback::GroupSourceFrame{frame->imageLease(), sourceStart, sourceEnd,
    uint64_t(start), uint64_t(end)};
  if (_frame->covers(_target)) _initialReady = YES;
  if (_decoder.drained && _windowRequested) {
    auto next = appleplayback::nextGroupDecodeWindow(query, _windowStart, _windowEnd,
      uint64_t(int64_t(_start) + _offset), uint64_t(int64_t(_end) + _offset), _supplyRate);
    if (next) {
      _windowStart = next->first; _windowEnd = next->second;
      _windowRequested = [_decoder requestStart:_windowStart end:_windowEnd];
      if (!_windowRequested) [self fail:2 underlying:_decoder.error];
    }
  }
}

- (std::optional<appleplayback::GroupSourceFrame>)frame {
  NSParameterAssert(NSThread.isMainThread);
  return _closed || _failed ? std::nullopt : _frame;
}
- (BOOL)scheduleRate:(float)rate globalTicks:(uint64_t)ticks hostTime:(CMTime)hostTime {
  NSParameterAssert(NSThread.isMainThread);
  if (_closed || _failed || !_seekCompleted || !_frame || !_frame->covers(ticks) ||
      !appleplayback::supportedGroupRate(rate) || !CMTIME_IS_NUMERIC(hostTime) ||
      CMTimeCompare(hostTime, CMClockGetTime(CMClockGetHostTimeClock())) <= 0) return NO;
  if (rate < 0) {
    if (!(rate == -.5 || rate == -2 || rate == -4 || rate == -6)) return NO;
    // Reverse pixels come from exact samples in the bounded banks. Audio stays
    // paused; its AVPlayer clock must not masquerade as the group clock.
    [_player pause]; _supplyRate = rate; _confirmedStopFrame.reset(); return YES;
  }
  const BOOL scheduled = _audioAbsent ?
    (CMTIME_IS_NUMERIC(hostTime) && CMTimeCompare(hostTime, CMClockGetTime(CMClockGetHostTimeClock())) > 0) :
    [_player scheduleRate:rate fromTime:CMTimeMake(int64_t(ticks) + _offset, 120000) atHostTime:hostTime];
  if (scheduled) { _supplyRate = rate; _confirmedStopFrame.reset(); }
  return scheduled;
}
- (BOOL)selectAudioTrack:(NSUInteger)track volume:(float)volume muted:(BOOL)muted {
  NSParameterAssert(NSThread.isMainThread);
  if (_closed || _failed || (!_audioAbsent && _player.status != AVPlayerItemStatusReadyToPlay) || !std::isfinite(volume) || volume < 0 || volume > 1) return NO;
  if (_audioAbsent) return track == 0;
  // A silent source may own a silent angle. No automatic alternate audio owner.
  if (_player.audioTrackCount && ![_player selectAudioTrack:track]) return NO;
  if (!_player.audioTrackCount && track) return NO;
  [_player setVolume:volume muted:muted]; return YES;
}
- (void)silence { NSParameterAssert(NSThread.isMainThread); [_player setVolume:0 muted:YES]; }
- (void)pauseForRefill { NSParameterAssert(NSThread.isMainThread); [_player pause]; }
- (void)pause { NSParameterAssert(NSThread.isMainThread); _supplyRate = 0; [_player pause]; }
- (void)close {
  NSParameterAssert(NSThread.isMainThread);
  if (_closed) return;
  _closed = YES; _frame.reset(); _confirmedStopFrame.reset(); _publishedFrames = {}; _publishedCursor = 0;
  [_decoder close]; [_player close];
}
- (BOOL)failed { return _failed; }
- (BOOL)imageReadInProgress { return !_decoder.drained; }
- (BOOL)drained { return _closed && !_activeSeeks && _decoder.drained; }
- (BOOL)seekCompleted { return !_closed && !_failed && _seekCompleted; }
- (NSError *)error { return _failure ?: _player.error; }
@end
