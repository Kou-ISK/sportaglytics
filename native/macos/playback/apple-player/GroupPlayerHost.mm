#import "GroupPlayerHost.hpp"
#import "GroupPlayerPair.hpp"
#include "ControlOutput.hpp"
#import <QuartzCore/QuartzCore.h>
#import <CommonCrypto/CommonDigest.h>
#include <cmath>
#include <fcntl.h>
#include <string>
#include <unistd.h>

namespace {
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
/// not claim package gaps/clip replacement or a reverse cache capability.
@interface STGroupPlayerHost : NSObject
- (instancetype)initWithManifest:(NSDictionary *)manifest;
- (int)run:(NSString *)result interrupted:(volatile sig_atomic_t *)interrupted;
@end
@implementation STGroupPlayerHost {
  NSDictionary *_manifest, *_intent;
  NSDictionary *_failureInfo;
  STGroupPlayerPair *_players;
  std::optional<appleplayback::FrameBudget> _budget;
  std::unique_ptr<GroupSurfaceSender> _sender;
  appleplayback::ControlOutput _output;
  std::string _input;
  uint64_t _start, _end, _anchor, _pair, _lastSentPair, _lastPublishedTicks, _revision;
  double _baseHost, _lastProgress, _lastObservation;
  BOOL _closing, _failed, _scheduled, _ready, _persisted, _exactAnchor, _audioValidated;
  double _closeAt;
}
- (instancetype)initWithManifest:(NSDictionary *)m {
  keys(m, @[@"version", @"mode", @"audioAngle", @"owner", @"sources", @"surfaceService", @"surfaceOwnerPID"]);
  integer(m[@"audioAngle"], 1);
  check(integer(m[@"version"], 2) == 2 && [m[@"mode"] isEqual:@"placed-pair-deadline-experiment"]);
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
    keys(s, @[@"path", @"sourceIndex", @"sourceEpoch", @"globalStart", @"globalEnd", @"sourceOffset"]);
    check([s[@"path"] isKindOfClass:NSString.class] && [s[@"path"] length] <= 4096 && [s[@"path"] isAbsolutePath]);
    auto a = integer(s[@"globalStart"], groupsurfacewire::MaximumTicks), b = integer(s[@"globalEnd"], groupsurfacewire::MaximumTicks);
    check(a < b && number(s[@"sourceOffset"]) && [s[@"sourceOffset"] doubleValue] == floor([s[@"sourceOffset"] doubleValue]) &&
      fabs([s[@"sourceOffset"] doubleValue]) <= groupsurfacewire::MaximumTicks);
    int64_t offset = [s[@"sourceOffset"] longLongValue];
    check(int64_t(a) + offset >= 0 && int64_t(b) + offset <= int64_t(groupsurfacewire::MaximumTicks));
    uint64_t epoch = integer(s[@"sourceEpoch"]); check(epoch > 0);
    placements[angle] = {integer(s[@"sourceIndex"], 31), epoch, a, b, offset};
    start = std::max(start, a); end = std::min(end, b);
    [urls addObject:[NSURL fileURLWithPath:s[@"path"]]];
  }
  check(placements[0].sourceIndex != placements[1].sourceIndex);
  check(start < end && [m[@"surfaceService"] isKindOfClass:NSString.class]);
  auto pid = integer(m[@"surfaceOwnerPID"], INT32_MAX); check(pid > 0);
  if ((self = [super init])) {
    _manifest = [m copy]; _start = start; _end = end;
    _budget.emplace(64ULL * 1024 * 1024);
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
  keys(v, expected);
  check([v[@"generation"] isEqual:_manifest[@"owner"][@"generation"]] && [v[@"sourceKey"] isEqual:_manifest[@"owner"][@"sourceKey"]]);
  auto op = integer(v[@"sequence"]), seek = integer(v[@"seekId"]); check(op && seek && seek <= op);
  bool playing = boolean(v[@"playing"]); boolean(v[@"muted"]);
  check(number(v[@"targetTime"]) && [v[@"targetTime"] doubleValue] >= 0 && [v[@"targetTime"] doubleValue] < 86400);
  check(number(v[@"rate"]) && number(v[@"volume"]) && [v[@"volume"] doubleValue] >= 0 && [v[@"volume"] doubleValue] <= 1);
  const double rate = [v[@"rate"] doubleValue];
  check((rate >= .25 && rate <= 6) || rate == -.5 || rate == -2 || rate == -4 || rate == -6);
  integer(v[@"audioTrack"], 7);
  uint64_t ticks = uint64_t(llround([v[@"targetTime"] doubleValue] * 120000));
  if (_intent) {
    check(op > integer(_intent[@"sequence"]) && seek >= integer(_intent[@"seekId"]));
    if (seek == integer(_intent[@"seekId"])) check([v[@"targetTime"] isEqual:_intent[@"targetTime"]]);
  } else check(!playing && seek == 1);
  // Release never authorizes a new target from the advancing player clock.
  // Pause both immediately, before validating the presentation fence.
  const bool sameSeek = _intent && seek == integer(_intent[@"seekId"]);
  const bool physicalSeek = !sameSeek || v[@"stopProof"] != nil;
  if (sameSeek && !v[@"stopProof"]) {
    // Control changes continue the shared timeline; targetTime remains the
    // original seek intent and must not rewind each repeat/rate/audio update.
    const double elapsed = _scheduled ? std::max(0.0, CACurrentMediaTime() - _baseHost) : 0;
    ticks = uint64_t(std::clamp(double(_anchor) + elapsed * [_intent[@"rate"] doubleValue] * 120000,
      double(_start), double(_end - 1)));
  }
  [_players pause];
  if (v[@"stopProof"]) {
    check(!playing && _intent != nil);
    NSDictionary *p = v[@"stopProof"];
    keys(p, @[@"operation", @"seek", @"pair", @"globalTicks", @"firstID", @"secondID"]);
    groupsurfacewire::StopProof proof{integer(p[@"operation"]), integer(p[@"seek"]), integer(p[@"pair"]),
      integer(p[@"globalTicks"], groupsurfacewire::MaximumTicks), integer(p[@"firstID"]), integer(p[@"secondID"])};
    ticks = _sender->stopAnchor(proof, op, seek);
  } else if (_intent && !playing && boolean(_intent[@"playing"]) && seek == integer(_intent[@"seekId"])) {
    check(false); // held release requires the actual complete canvas pair
  }
  check(ticks >= _start && ticks < _end);
  check(physicalSeek ? [_players seek:ticks operation:op] : [_players adoptOperation:op]);
  _exactAnchor = physicalSeek || !playing;
  _intent = [v copy]; _anchor = ticks; _scheduled = NO; _ready = NO; _audioValidated = NO;
  _lastSentPair = 0; _lastProgress = CACurrentMediaTime();
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
  [_players poll];
  if (_players.failed) {
    NSError *error = _players.error;
    NSMutableArray *chain = [NSMutableArray array];
    for (size_t i = 0; error && i < 4; ++i) {
      NSString *domain = [@[@"SportagGroupSource", @"SportagSampleMetadata", @"AVFoundationErrorDomain",
        @"NSOSStatusErrorDomain", @"NSCocoaErrorDomain"] containsObject:error.domain] ? error.domain : @"other";
      NSMutableDictionary *detail = [@{@"domain":domain, @"code":@(error.code)} mutableCopy];
      id pts = error.userInfo[@"displayTime"];
      if ([domain isEqual:@"SportagSampleMetadata"] && number(pts) && [pts doubleValue] >= 0 &&
          [pts doubleValue] <= groupsurfacewire::MaximumTicks) detail[@"displayTime"] = pts;
      [chain addObject:detail];
      id next = error.userInfo[NSUnderlyingErrorKey]; error = [next isKindOfClass:NSError.class] ? next : nil;
    }
    _failureInfo = @{@"stage":@"source", @"chain":chain}; check(false);
  }
  const uint64_t op = [_intent[@"sequence"] unsignedLongLongValue], seek = [_intent[@"seekId"] unsignedLongLongValue];
  const BOOL playing = [_intent[@"playing"] boolValue]; const double rate = [_intent[@"rate"] doubleValue];
  auto a = _sender->drawn(0), b = _sender->drawn(1);
  if (a && b && a->operation == op && b->operation == op && a->pair == b->pair && a->pair == _lastSentPair) {
    _ready = YES;
    if (playing && !_scheduled) {
      check([_players selectAudioAngle:[_manifest[@"audioAngle"] unsignedIntegerValue]
        track:[_intent[@"audioTrack"] unsignedIntegerValue] volume:[_intent[@"volume"] floatValue]
        muted:rate < 0 || [_intent[@"muted"] boolValue]]);
      CMTime host = CMTimeAdd(CMClockGetTime(CMClockGetHostTimeClock()), CMTimeMake(1, 20));
      check([_players scheduleRate:rate globalTicks:_anchor hostTime:host]);
      _baseHost = CMTimeGetSeconds(host); _scheduled = YES;
    }
  }
  uint64_t target = _anchor;
  if (_scheduled) {
    const double elapsed = std::max(0.0, CACurrentMediaTime() - _baseHost);
    const double desired = double(_anchor) + elapsed * rate * 120000;
    if (desired < _start || desired >= _end) { [_players pause]; _scheduled = NO; _ready = NO; [self close]; return; }
    target = uint64_t(llround(desired));
  }
  // Full pair credits and a new demand are required. The code never relabels
  // either frame as a requested time which its actual sample does not cover.
  if (_output.count() < 4 && (!_lastSentPair || (_scheduled && _sender->demanded()))) {
    check(_pair < groupsurfacewire::MaximumSequence);
    auto actual = [_players availableAnchor:target];
    const uint64_t pair = _pair + 1, firstID = _sender->nextID();
    if (actual && !_audioValidated) {
      check([_players selectAudioAngle:[_manifest[@"audioAngle"] unsignedIntegerValue]
        track:[_intent[@"audioTrack"] unsignedIntegerValue] volume:0 muted:YES]);
      _audioValidated = YES;
    }
    // Exact initial/stop seek may not use a nearby anchor. During continuous
    // playback, allow only measured common images within one wall second.
    if (actual && (!_lastSentPair && _exactAnchor ? *actual == target :
        ((!_lastSentPair || *actual != _lastPublishedTicks) && std::abs(double(*actual) - target) < std::abs(rate) * 120000)) &&
        [_players publish:{op, seek, pair, *actual} sender:*_sender]) {
      _pair = pair;
      if (!_lastSentPair) _anchor = *actual;
      _lastSentPair = pair; _lastPublishedTicks = *actual; _lastProgress = CACurrentMediaTime();
      _sender->consumedDemand();
      [self enqueue:@{@"type":@"surface-ready", @"generation":_intent[@"generation"], @"id":@(firstID)}];
      [self enqueue:@{@"type":@"surface-ready", @"generation":_intent[@"generation"], @"id":@(firstID + 1)}];
    }
  }
  // Image starvation does not keep publishing an advancing synthetic clock.
  check(CACurrentMediaTime() - _lastProgress < (_scheduled ? 1.0 : 10.0) || (_ready && !playing));
  if (CACurrentMediaTime() - _lastObservation >= .05 && _output.count() < 6) {
    _lastObservation = CACurrentMediaTime();
    const bool shown = a && b && a->operation == op && b->operation == op && a->pair == b->pair;
    const uint64_t shownTime = shown ? a->globalTicks : _anchor;
    const auto measuredRate = [_players observedRate];
    const bool running = _scheduled && measuredRate && std::abs(*measuredRate) > .001f;
    [self enqueue:@{@"type":@"observation", @"value":@{
      @"generation":_intent[@"generation"], @"sourceKey":_intent[@"sourceKey"], @"revision":@(++_revision),
      @"sequence":@(op), @"seekId":@(seek), @"phase":!shown ? @"preparing" : running ? @"playing" : _scheduled ? @"buffering" : @"paused",
      @"time":@(double(shownTime) / 120000), @"rate":@(measuredRate ? *measuredRate : 0),
      @"audioTrack":_intent[@"audioTrack"], @"volume":_intent[@"volume"], @"muted":_intent[@"muted"],
      @"videoReady":@(shown), @"audioReady":@(_ready && _audioValidated), @"error":[NSNull null]}}];
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
              @"quarantinedBytes":@(_budget->quarantinedBytes())} options:0 error:nil];
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
