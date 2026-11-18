#import "GroupPlayerHost.hpp"
#import "GroupPlayerPair.hpp"
#include "ControlOutput.hpp"
#include "GroupPlaybackClock.hpp"
#import <QuartzCore/QuartzCore.h>
#import <CommonCrypto/CommonDigest.h>
#include <cmath>
#include <fcntl.h>
#include <string>
#include <unistd.h>

namespace {
double groupHostNow() { return CMTimeGetSeconds(CMClockGetTime(CMClockGetHostTimeClock())); }
void check(bool value) { if (!value) throw std::runtime_error("invalid placed-pair host protocol"); }
bool number(id v) {
  return [v isKindOfClass:NSNumber.class] && CFGetTypeID((__bridge CFTypeRef)v) != CFBooleanGetTypeID() && std::isfinite([v doubleValue]);
}
uint64_t integer(id v, uint64_t max = groupsurfacewire::MaximumSequence) {
  check(number(v) && [v doubleValue] >= 0 && [v doubleValue] <= max && [v doubleValue] == floor([v doubleValue]));
  return [v unsignedLongLongValue];
}
bool boolean(id v) {
  check([v isKindOfClass:NSNumber.class] && CFGetTypeID((__bridge CFTypeRef)v) == CFBooleanGetTypeID());
  return [v boolValue];
}
void keys(NSDictionary *v, NSArray<NSString *> *expected) {
  check([v isKindOfClass:NSDictionary.class] && [[NSSet setWithArray:v.allKeys] isEqualToSet:[NSSet setWithArray:expected]]);
}
void opaque(id value) {
  check([value isKindOfClass:NSString.class] && [value length] >= 1 && [value length] <= 128);
  check([value rangeOfCharacterFromSet:[[NSCharacterSet characterSetWithCharactersInString:@"abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_"] invertedSet]].location == NSNotFound);
}
}

/// Pipe/process adapter owns one finite qualified pair. This deliberately does
/// not claim package gaps/clip replacement or signed production capability.
@interface STGroupPlayerHost : NSObject
- (instancetype)initWithManifest:(NSDictionary *)manifest;
- (int)run:(NSString *)result interrupted:(volatile sig_atomic_t *)interrupted;
@end
@implementation STGroupPlayerHost {
  NSDictionary *_manifest, *_intent;
  NSDictionary *_failureInfo;
  STGroupPlayerPair *_players;
  std::optional<appleplayback::FrameBudget> _budget;
  std::optional<appleplayback::GroupPlaybackClock> _clock;
  std::unique_ptr<GroupSurfaceSender> _sender;
  appleplayback::ControlOutput _output;
  std::string _input;
  uint64_t _start, _end, _anchor, _pair, _lastSentPair, _lastPublishedTicks, _revision, _lastDrawnPair, _lastDrawnOperation, _lastDrawnSeek, _lastDrawnTicks, _waitingPair;
  double _lastProgress, _lastObservation, _lastDrawnAt, _waitBeganAt;
  BOOL _closing, _failed, _scheduled, _ready, _persisted, _audioValidated;
  double _closeAt;
}
- (instancetype)initWithManifest:(NSDictionary *)m {
  keys(m, @[@"version", @"mode", @"audioAngle", @"owner", @"sources", @"surfaceService", @"surfaceOwnerPID"]);
  integer(m[@"audioAngle"], 1);
  check(integer(m[@"version"], 2) == 2 && [m[@"mode"] isEqual:@"placed-pair-decoded-samples"]);
  keys(m[@"owner"], @[@"generation", @"sourceKey"]); opaque(m[@"owner"][@"generation"]); opaque(m[@"owner"][@"sourceKey"]);
  NSString *key = m[@"owner"][@"sourceKey"];
  check(key.length == 64 && [key rangeOfCharacterFromSet:
    [[NSCharacterSet characterSetWithCharactersInString:@"0123456789abcdef"] invertedSet]].location == NSNotFound);
  check([m[@"sources"] isKindOfClass:NSArray.class] && [m[@"sources"] count] == 2);
  std::array<appleplayback::GroupClipPlacement, 2> placements;
  NSMutableArray<NSURL *> *urls = [NSMutableArray array];
  uint64_t start = 0, end = groupsurfacewire::MaximumTicks;
  for (size_t angle = 0; angle < 2; ++angle) {
    NSDictionary *s = m[@"sources"][angle];
    keys(s, @[@"path", @"sourceRevision", @"sourceIndex", @"sourceEpoch", @"globalStart", @"globalEnd", @"sourceOffset"]);
    check([s[@"path"] isKindOfClass:NSString.class] && [s[@"path"] length] <= 4096 && [s[@"path"] isAbsolutePath]);
    check([s[@"sourceRevision"] isKindOfClass:NSString.class] && [s[@"sourceRevision"] length] > 0 && [s[@"sourceRevision"] length] <= 256 && [s[@"sourceRevision"] UTF8String] != nullptr);
    auto a = integer(s[@"globalStart"], groupsurfacewire::MaximumTicks), b = integer(s[@"globalEnd"], groupsurfacewire::MaximumTicks);
    check(a < b && number(s[@"sourceOffset"]) && [s[@"sourceOffset"] doubleValue] == floor([s[@"sourceOffset"] doubleValue]) &&
      fabs([s[@"sourceOffset"] doubleValue]) <= groupsurfacewire::MaximumTicks);
    int64_t offset = [s[@"sourceOffset"] longLongValue];
    check(int64_t(a) + offset >= 0 && int64_t(b) + offset <= int64_t(groupsurfacewire::MaximumTicks));
    uint64_t epoch = integer(s[@"sourceEpoch"]); check(epoch > 0);
    placements[angle] = {integer(s[@"sourceIndex"], 31), epoch, a, b, offset, std::string([s[@"sourceRevision"] UTF8String])};
    start = std::max(start, a); end = std::min(end, b);
    [urls addObject:[NSURL fileURLWithPath:s[@"path"]]];
  }
  check(placements[0].sourceIndex != placements[1].sourceIndex);
  check(start < end && [m[@"surfaceService"] isKindOfClass:NSString.class]);
  auto pid = integer(m[@"surfaceOwnerPID"], INT32_MAX); check(pid > 0);
  if ((self = [super init])) {
    _manifest = [m copy]; _start = start; _end = end;
    _budget.emplace(512ULL * 1024 * 1024);
    _clock.emplace(start, end);
    _sender = std::make_unique<GroupSurfaceSender>(*_budget);
    _sender->open([m[@"surfaceService"] UTF8String], pid_t(pid));
    _players = [[STGroupPlayerPair alloc] initWithURLs:urls placements:placements budget:*_budget];
  }
  return self;
}
- (void)enqueue:(NSDictionary *)value {
  NSData *data = [NSJSONSerialization dataWithJSONObject:value options:0 error:nil]; check(data != nil);
  _output.push(std::string((const char *)data.bytes, data.length));
}
- (void)close {
  if (_closing) return;
  _closing = YES; _closeAt = CACurrentMediaTime(); [_players close];
}
- (void)accept:(NSDictionary *)v {
  auto expected = [NSMutableArray arrayWithArray:@[@"generation", @"sourceKey", @"sequence", @"seekId", @"targetTime", @"playing", @"rate", @"audioTrack", @"volume", @"muted"]];
  if (v[@"stopProof"]) [expected addObject:@"stopProof"];
  if (v[@"seekMode"]) [expected addObject:@"seekMode"];
  keys(v, expected);
  check([v[@"generation"] isEqual:_manifest[@"owner"][@"generation"]] && [v[@"sourceKey"] isEqual:_manifest[@"owner"][@"sourceKey"]]);
  auto op = integer(v[@"sequence"]), seek = integer(v[@"seekId"]); check(op && seek && seek <= op);
  bool playing = boolean(v[@"playing"]); boolean(v[@"muted"]);
  if (v[@"seekMode"]) {
    check([v[@"seekMode"] isEqual:@"preview"] || [v[@"seekMode"] isEqual:@"scrub"]);
    check(![v[@"seekMode"] isEqual:@"preview"] || !playing);
  }
  check(number(v[@"targetTime"]) && [v[@"targetTime"] doubleValue] >= 0 && [v[@"targetTime"] doubleValue] < 86400);
  check(number(v[@"rate"]) && number(v[@"volume"]) && [v[@"volume"] doubleValue] >= 0 && [v[@"volume"] doubleValue] <= 1);
  const double rate = [v[@"rate"] doubleValue];
  check((rate >= .25 && rate <= 6) || rate == -.5 || rate == -2 || rate == -4 || rate == -6);
  integer(v[@"audioTrack"], 7);
  uint64_t ticks = uint64_t(llround([v[@"targetTime"] doubleValue] * 120000));
  if (_intent) {
    check(op > integer(_intent[@"sequence"]) && seek >= integer(_intent[@"seekId"]));
    if (seek == integer(_intent[@"seekId"])) {
      check([v[@"targetTime"] isEqual:_intent[@"targetTime"]]);
      check((!v[@"seekMode"] && !_intent[@"seekMode"]) || [v[@"seekMode"] isEqual:_intent[@"seekMode"]]);
    }
  } else check(!playing && seek == 1);
  // Release never authorizes a new target from the advancing player clock.
  // Pause both immediately, before validating the presentation fence.
  const bool sameSeek = _intent && seek == integer(_intent[@"seekId"]);
  const bool returnsToAudio = _intent && [_intent[@"rate"] doubleValue] < 0 && rate > 0 && playing;
  const bool physicalSeek = !sameSeek || v[@"stopProof"] != nil || returnsToAudio;
  if (sameSeek && !v[@"stopProof"]) {
    // Control changes continue the shared timeline; targetTime remains the
    // original seek intent and must not rewind each repeat/rate/audio update.
    ticks = _scheduled ? _clock->sample(groupHostNow()).ticks : _anchor;
  }
  [_players pause];
  uint64_t confirmedPair = 0;
  if (v[@"stopProof"]) {
    check(!playing && _intent != nil);
    NSDictionary *p = v[@"stopProof"];
    keys(p, @[@"operation", @"seek", @"pair", @"globalTicks", @"firstID", @"secondID"]);
    groupsurfacewire::StopProof proof{integer(p[@"operation"]), integer(p[@"seek"]), integer(p[@"pair"]),
      integer(p[@"globalTicks"], groupsurfacewire::MaximumTicks), integer(p[@"firstID"]), integer(p[@"secondID"])};
    ticks = _sender->stopAnchor(proof, op, seek);
    confirmedPair = proof.pair;
  } else if (_intent && !playing && boolean(_intent[@"playing"]) && seek == integer(_intent[@"seekId"])) {
    check(false); // held release requires the actual complete canvas pair
  }
  check(ticks >= _start && ticks < _end);
  BOOL accepted;
  if (confirmedPair) accepted = [_players seek:ticks operation:op publishedPair:confirmedPair];
  else if (physicalSeek) accepted = [_players seek:ticks operation:op];
  else accepted = [_players adoptOperation:op];
  check(accepted);
  _clock->pauseAt(ticks);
  _intent = [v copy]; _anchor = ticks; _scheduled = NO; _ready = NO; _audioValidated = NO;
  _lastSentPair = 0; _waitingPair = 0; _waitBeganAt = 0; _lastProgress = CACurrentMediaTime();
}
- (void)readCommands {
  char bytes[4096];
  for (int i = 0; i < 4; ++i) {
    ssize_t n = read(STDIN_FILENO, bytes, sizeof(bytes));
    if (n < 0 && (errno == EAGAIN || errno == EINTR)) return;
    check(n >= 0); if (!n) { [self close]; return; }
    _input.append(bytes, n); size_t end;
    while ((end = _input.find('\n')) != std::string::npos) {
      std::string line = _input.substr(0, end); _input.erase(0, end + 1);
      if (line == "q") { [self close]; return; }
      check(line.size() <= 4096);
      NSData *data = [NSData dataWithBytes:line.data() length:line.size()];
      NSDictionary *v = [NSJSONSerialization JSONObjectWithData:data options:0 error:nil];
      check([v isKindOfClass:NSDictionary.class]); [self accept:v];
    }
    check(_input.size() < 4096);
  }
}
- (void)update {
  if (!_intent) return;
  uint64_t target = _clock->pendingTarget().value_or(_anchor);
  if (_scheduled) {
    const auto clock = _clock->sample(groupHostNow());
    if (clock.ended) { [_players pause]; _scheduled = NO; _ready = NO; [self close]; return; }
    target = clock.ticks;
  }
  [_players pollAtGlobalTime:target];
  if (_players.failed) {
    NSError *error = _players.error;
    NSMutableArray *chain = [NSMutableArray array];
    for (size_t i = 0; error && i < 4; ++i) {
      NSString *domain = [@[@"SportagGroupSource", @"SportagDecodeWindow", @"AVFoundationErrorDomain",
        @"NSOSStatusErrorDomain", @"NSCocoaErrorDomain"] containsObject:error.domain] ? error.domain : @"other";
      NSMutableDictionary *detail = [@{@"domain":domain, @"code":@(error.code)} mutableCopy];
      [chain addObject:detail];
      id next = error.userInfo[NSUnderlyingErrorKey]; error = [next isKindOfClass:NSError.class] ? next : nil;
    }
    _failureInfo = @{@"stage":@"source", @"chain":chain}; check(false);
  }
  const uint64_t op = [_intent[@"sequence"] unsignedLongLongValue], seek = [_intent[@"seekId"] unsignedLongLongValue];
  const BOOL playing = [_intent[@"playing"] boolValue]; const double rate = [_intent[@"rate"] doubleValue];
  auto a = _sender->drawn(0), b = _sender->drawn(1);
  const bool complete = a && b && a->operation == op && b->operation == op &&
    a->seek == seek && b->seek == seek && a->pair == b->pair;
  if (complete && a->pair != _lastDrawnPair) {
    _lastDrawnPair = a->pair; _lastDrawnOperation = op; _lastDrawnSeek = seek;
    _lastDrawnTicks = a->globalTicks; _lastDrawnAt = CACurrentMediaTime();
  }
  auto available = [_players availableAnchor:target];
  if (_scheduled && _clock->sample(groupHostNow()).running && (!available || *available != target || CACurrentMediaTime() - _lastDrawnAt >= .25)) {
    check(_lastDrawnOperation == op && _lastDrawnSeek == seek);
    // Hold the last complete image while one fixed next target is prepared.
    // Do not keep advancing the target past a slow decoder or call it playing.
    [_players pauseForRefill]; _clock->suspend(_lastDrawnTicks, target);
    _anchor = _lastDrawnTicks; _scheduled = NO; _ready = NO;
    _waitingPair = 0; _waitBeganAt = CACurrentMediaTime();
  }
  const auto pending = _clock->pendingTarget();
  if (complete && a->pair == _lastSentPair && (!pending || a->pair == _waitingPair)) {
    _ready = YES;
    if (playing && !_scheduled) {
      if (pending) { check(a->globalTicks == *pending); _anchor = a->globalTicks; }
      check([_players selectAudioAngle:[_manifest[@"audioAngle"] unsignedIntegerValue]
        track:[_intent[@"audioTrack"] unsignedIntegerValue] volume:[_intent[@"volume"] floatValue]
        muted:rate < 0 || [_intent[@"muted"] boolValue]]);
      CMTime host = CMClockGetTime(CMClockGetHostTimeClock());
      if (rate > 0) host = CMTimeAdd(host, CMTimeMake(1, 20));
      check([_players scheduleRate:rate globalTicks:_anchor hostTime:host]);
      const double now = groupHostNow();
      if (rate < 0) {
        if (pending) _clock->resumeReverseAt(a->globalTicks, rate, now);
        else _clock->startReverse(a->globalTicks, rate, now);
      } else if (pending) _clock->resumeAt(_anchor, rate, CMTimeGetSeconds(host), now);
      else _clock->schedule(_anchor, rate, CMTimeGetSeconds(host), now);
      _scheduled = YES; _waitingPair = 0; _waitBeganAt = 0;
    }
  }
  // Full pair credits and a new demand are required. The code never relabels
  // either frame as a requested time which its actual sample does not cover.
  if (_output.count() < 4 && (!_lastSentPair || ((_scheduled || (_clock->pendingTarget() && !_waitingPair)) && _sender->demanded()))) {
    check(_pair < groupsurfacewire::MaximumSequence);
    auto actual = [_players availableAnchor:target];
    const uint64_t pair = _pair + 1, firstID = _sender->nextID();
    if (actual && !_audioValidated) {
      check([_players selectAudioAngle:[_manifest[@"audioAngle"] unsignedIntegerValue]
        track:[_intent[@"audioTrack"] unsignedIntegerValue] volume:0 muted:YES]);
      _audioValidated = YES;
    }
    // A requested clock outside the available intervals waits explicitly;
    // it never relabels an older image as this target, even during buffering.
    if (actual && *actual == target &&
        (! _lastSentPair || *actual != _lastPublishedTicks) &&
        [_players publish:{op, seek, pair, *actual} sender:*_sender]) {
      _pair = pair;
      if (!_lastSentPair) _anchor = *actual;
      if (_clock->pendingTarget()) _waitingPair = pair;
      _lastSentPair = pair; _lastPublishedTicks = *actual; _lastProgress = CACurrentMediaTime();
      _sender->consumedDemand();
      [self enqueue:@{@"type":@"surface-ready", @"generation":_intent[@"generation"], @"id":@(firstID)}];
      [self enqueue:@{@"type":@"surface-ready", @"generation":_intent[@"generation"], @"id":@(firstID + 1)}];
    }
  }
  // Image starvation does not keep publishing an advancing synthetic clock.
  if (_clock->pendingTarget()) {
    if (CACurrentMediaTime() - _waitBeganAt >= 5.5) {
      _failureInfo = @{@"stage":@"sample-wait-timeout"}; check(false);
    }
  }
  else check(CACurrentMediaTime() - _lastProgress < (_scheduled ? 1.0 : 10.0) || (_ready && !playing));
  if (CACurrentMediaTime() - _lastObservation >= .05 && _output.count() < 6) {
    _lastObservation = CACurrentMediaTime();
    const bool shown = _lastDrawnOperation == op && _lastDrawnSeek == seek && _lastDrawnPair > 0;
    const uint64_t shownTime = shown ? _lastDrawnTicks : _anchor;
    // Rate belongs to the canonical host clock. Observation time is the last
    // complete drawn pair, never that advancing target or an AVPlayer deadline.
    const double clockRate = _scheduled ? _clock->scheduledRate(groupHostNow()) : 0;
    const bool running = clockRate != 0 && CACurrentMediaTime() - _lastDrawnAt < .25;
    const bool ready = shown && _ready && (running || !playing);
    [self enqueue:@{@"type":@"observation", @"value":@{
      @"generation":_intent[@"generation"], @"sourceKey":_intent[@"sourceKey"], @"revision":@(++_revision),
      @"sequence":@(op), @"seekId":@(seek), @"phase":!shown ? @"preparing" : running ? @"playing" : playing ? @"buffering" : @"paused",
      @"time":@(double(shownTime) / 120000), @"rate":@(running ? clockRate : 0),
      @"audioTrack":_intent[@"audioTrack"], @"volume":_intent[@"volume"], @"muted":_intent[@"muted"],
      @"videoReady":@(ready), @"audioReady":@(ready && _audioValidated), @"error":[NSNull null]}}];
  }
}
- (int)run:(NSString *)result interrupted:(volatile sig_atomic_t *)interrupted {
  while (true) {
    if (_closing && CACurrentMediaTime() - _closeAt > 10) return 1;
    @autoreleasepool {
      @try {
        try {
          _sender->poll();
          if (_output.flush(STDOUT_FILENO) == appleplayback::FlushResult::disconnected) { [self close]; return 1; }
          if (*interrupted) [self close];
          if (!_closing) { [self readCommands]; if (!_closing) [self update]; }
          if (_closing && _players.drained && !_sender->pending() && !_output.count() && !_persisted) {
            NSData *data = [NSJSONSerialization dataWithJSONObject:@{@"engine":@"AVPlayerGroup", @"success":@(!_failed),
              @"stoppedClock":[NSNull null], @"failure":_failureInfo ?: (_failed ? @{@"stage":@"control-or-transfer"} : [NSNull null]), @"heldBytes":@(_budget->usedBytes()),
              @"quarantinedBytes":@(_budget->quarantinedBytes()), @"peakChargedImageBytes":@(_budget->peakUsedBytes())} options:0 error:nil];
            const BOOL saved = data && [data writeToFile:result options:NSDataWritingWithoutOverwriting error:nil];
            unsigned char digest[CC_SHA256_DIGEST_LENGTH]; NSMutableString *hash = [NSMutableString string];
            if (saved) {
              CC_SHA256(data.bytes, (CC_LONG)data.length, digest);
              for (unsigned char byte : digest) [hash appendFormat:@"%02x", byte];
            }
            [self enqueue:@{@"type":@"drained", @"generation":_manifest[@"owner"][@"generation"],
              @"nativeDrained":@YES, @"stoppedClock":[NSNull null], @"resultPersisted":@(saved),
              @"resultSHA256":hash, @"success":@(saved && !_failed), @"requiresOwnerExitZero":@YES}];
            _persisted = YES; if (!saved) _failed = YES;
          }
          if (_persisted && !_output.count()) return _failed ? 1 : 0;
        } catch (const std::exception &) { _failed = YES; [self close]; }
      } @catch (NSException *) { _failed = YES; [self close]; }
      [[NSRunLoop mainRunLoop] runUntilDate:[NSDate dateWithTimeIntervalSinceNow:.004]];
    }
  }
}
@end
int runAppleGroupHost(NSDictionary *manifest, NSString *result, volatile sig_atomic_t *interrupted) {
  return [[[STGroupPlayerHost alloc] initWithManifest:manifest] run:result interrupted:interrupted];
}
