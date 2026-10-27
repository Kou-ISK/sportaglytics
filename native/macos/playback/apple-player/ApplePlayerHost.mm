#import "ApplePlayerSession.hpp"
#include "../apple-export/AppleClipExport.hpp"
#include "ControlOutput.hpp"
#include "PlayerObservation.hpp"
#import <AppKit/AppKit.h>
#import <CommonCrypto/CommonDigest.h>
#import <QuartzCore/QuartzCore.h>
#include "../surface-transport/SurfaceSender.hpp"
#include <cmath>
#include <csignal>
#include <fcntl.h>
#include <string>
#include <sys/stat.h>
#include <unistd.h>

namespace {
volatile sig_atomic_t interrupted = 0;
void interrupt(int) { interrupted = 1; }
void require(bool valid, NSString *reason) {
  if (!valid) @throw [NSException exceptionWithName:@"PlaybackFailure" reason:reason userInfo:nil];
}
NSString *sha256(NSData *data) {
  unsigned char bytes[CC_SHA256_DIGEST_LENGTH];
  CC_SHA256(data.bytes, (CC_LONG)data.length, bytes);
  NSMutableString *hash = [NSMutableString string];
  for (unsigned char byte : bytes) [hash appendFormat:@"%02x", byte];
  return hash;
}
bool numeric(id value) {
  return [value isKindOfClass:NSNumber.class] && CFGetTypeID((__bridge CFTypeRef)value) != CFBooleanGetTypeID() && std::isfinite([value doubleValue]);
}
struct SampleOwner {
  CMSampleBufferRef sample;
  ~SampleOwner() { if (sample) CFRelease(sample); }
};
struct OutputDisconnected {};
}

/// Process/IPC adapter only. AVPlayerSession owns the entire media pipeline.
@interface STApplePlayerHost : NSObject
- (instancetype)initWithManifest:(NSDictionary *)manifest result:(NSString *)result;
- (int)run;
@end
@implementation STApplePlayerHost {
  NSDictionary *_manifest, *_intent, *_stopped;
  NSString *_result, *_failure;
  STApplePlayerSession *_engine;
  SurfaceSender _surfaces;
  std::string _input;
  appleplayback::ControlOutput _output;
  uint64_t _seek, _revision, _imagePTS, _controlSequence, _rateSequence;
  BOOL _seeking, _seekCompleted, _imageSent, _ready, _closing, _persisted;
  double _openedAt, _closeAt, _observedAt;
}
- (instancetype)initWithManifest:(NSDictionary *)manifest result:(NSString *)result {
  if ((self = [super init])) {
    _manifest = manifest; _result = result; _openedAt = CACurrentMediaTime();
    _surfaces.open([manifest[@"surfaceService"] UTF8String], [manifest[@"surfaceOwnerPID"] intValue]);
    _engine = [[STApplePlayerSession alloc] initWithURL:[NSURL fileURLWithPath:manifest[@"source"]]];
  }
  return self;
}
- (void)enqueue:(NSDictionary *)value {
  NSData *data = [NSJSONSerialization dataWithJSONObject:value options:0 error:nil];
  require(data != nil, @"playback response serialization");
  _output.push(std::string((const char *)data.bytes, data.length));
}
- (void)flush {
  if (_output.flush(STDOUT_FILENO) == appleplayback::FlushResult::disconnected) throw OutputDisconnected{};
}
- (void)accept:(NSDictionary *)value {
  NSMutableSet *keys = [NSMutableSet setWithArray:@[@"generation", @"sourceKey", @"sequence", @"seekId", @"targetTime", @"playing", @"rate", @"audioTrack", @"volume", @"muted"]];
  if ([value isKindOfClass:NSDictionary.class] && value[@"seekMode"]) {
    require([value[@"seekMode"] isEqual:@"preview"] || [value[@"seekMode"] isEqual:@"scrub"], @"playback seek mode");
    [keys addObject:@"seekMode"];
  }
  require([value isKindOfClass:NSDictionary.class] && [[NSSet setWithArray:value.allKeys] isEqualToSet:keys], @"playback command keys");
  require([value[@"generation"] isEqual:_manifest[@"owner"][@"generation"]] && [value[@"sourceKey"] isEqual:_manifest[@"owner"][@"sourceKey"]], @"playback command owner");
  for (NSString *key in @[@"sequence", @"seekId", @"targetTime", @"rate", @"audioTrack", @"volume"]) require(numeric(value[key]), @"playback command number");
  for (NSString *key in @[@"playing", @"muted"]) require([value[key] isKindOfClass:NSNumber.class] && CFGetTypeID((__bridge CFTypeRef)value[key]) == CFBooleanGetTypeID(), @"playback command boolean");
  double seq = [value[@"sequence"] doubleValue], seek = [value[@"seekId"] doubleValue], target = [value[@"targetTime"] doubleValue], track = [value[@"audioTrack"] doubleValue];
  require(seq >= 1 && seq <= 9007199254740991.0 && seq == floor(seq) && seek >= 1 && seek <= seq && seek == floor(seek), @"playback command identifiers");
  require(target >= 0 && target < 86400 && track >= 0 && track < 8 && track == floor(track), @"playback command scope");
  require([value[@"rate"] doubleValue] >= .25 && [value[@"rate"] doubleValue] <= 6 && [value[@"volume"] doubleValue] >= 0 && [value[@"volume"] doubleValue] <= 1, @"playback controls range");
  if (_intent) require(seq > [_intent[@"sequence"] doubleValue] && seek >= [_intent[@"seekId"] doubleValue] && (seek != [_intent[@"seekId"] doubleValue] || (target == [_intent[@"targetTime"] doubleValue] && [(value[@"seekMode"] ?: @"exact") isEqual:(_intent[@"seekMode"] ?: @"exact")])), @"playback command order");
  else require(seek == 1 && ![value[@"playing"] boolValue], @"initial playback command");
  _intent = [value copy];
  if (![value[@"playing"] boolValue]) [_engine pause];
}
- (void)readCommands {
  char bytes[4096];
  for (int iteration = 0; iteration < 4; iteration++) {
    ssize_t count = read(STDIN_FILENO, bytes, sizeof(bytes));
    if (count < 0 && (errno == EAGAIN || errno == EINTR)) break;
    require(count >= 0, @"playback control read");
    if (!count) { [self close]; break; }
    _input.append(bytes, count);
    size_t end;
    while ((end = _input.find('\n')) != std::string::npos) {
      std::string line = _input.substr(0, end); _input.erase(0, end + 1);
      if (line == "q") { [self close]; return; }
      require(line.size() <= 4096, @"playback command size");
      NSData *data = [NSData dataWithBytes:line.data() length:line.size()];
      [self accept:[NSJSONSerialization JSONObjectWithData:data options:0 error:nil]];
    }
    require(_input.size() < 4096, @"incomplete playback command bound");
  }
}
- (void)observe:(appleplayback::PlayerObservation)state {
  BOOL failed = strcmp(state.phase, "failed") == 0;
  if (!_intent || _closing || (!failed && _output.count() >= 6)) return;
  double time = CMTimeGetSeconds(_engine.currentTime);
  if (failed && !std::isfinite(time)) time = [_intent[@"targetTime"] doubleValue];
  if (!std::isfinite(time)) return;
  [self enqueue:@{@"type":@"observation", @"value":@{
    @"generation":_intent[@"generation"], @"sourceKey":_intent[@"sourceKey"],
    @"revision":@(++_revision), @"sequence":_intent[@"sequence"], @"seekId":_intent[@"seekId"],
    @"phase":@(state.phase), @"time":@(time), @"rate":@(state.rate),
    @"audioTrack":_intent[@"audioTrack"], @"volume":_intent[@"volume"], @"muted":_intent[@"muted"],
    @"videoReady":@(state.ready), @"audioReady":@(state.ready), @"error":failed ? @"media" : [NSNull null]
  }}];
}
- (void)failMedia:(NSString *)reason {
  _failure = reason;
  [_engine pause];
  // Report an unsupported item/control before normal drainage so Main can
  // restore the original player. Malformed IPC remains a protocol failure.
  [self observe:{"failed", 0, false}];
  [self close];
}
- (void)updatePlayer {
  if (_engine.status == AVPlayerItemStatusFailed) {
    [self failMedia:_engine.error.localizedDescription ?: @"Apple player failed"]; return;
  }
  if (_engine.status != AVPlayerItemStatusReadyToPlay) {
    require(CACurrentMediaTime() - _openedAt < 15, @"Apple player open timeout"); return;
  }
  if (!_intent) return;
  require([_intent[@"targetTime"] doubleValue] < CMTimeGetSeconds(_engine.duration), @"seek outside media");
  if (_controlSequence != [_intent[@"sequence"] unsignedLongLongValue]) {
    if (![_engine supportsRate:[_intent[@"rate"] floatValue]]) {
      [self failMedia:@"playback rate unavailable"]; return;
    }
    if (![_engine selectAudioTrack:[_intent[@"audioTrack"] unsignedIntegerValue]]) {
      [self failMedia:@"audio track unavailable"]; return;
    }
    [_engine setVolume:[_intent[@"volume"] floatValue] muted:[_intent[@"muted"] boolValue]];
    _controlSequence = [_intent[@"sequence"] unsignedLongLongValue];
  }
  uint64_t seek = [_intent[@"seekId"] unsignedLongLongValue];
  if (_seek != seek) {
    [_engine pause]; _seek = seek; _ready = NO; _imageSent = NO; _seekCompleted = NO; _seeking = YES; _rateSequence = 0;
    double target = [_intent[@"targetTime"] doubleValue];
    CMTime time = CMTimeMakeWithSeconds(target, 1000000000);
    [_engine seekToTime:time approximate:_intent[@"seekMode"] != nil completion:^(BOOL finished) {
      if (!self->_closing && self->_seek == seek) { self->_seekCompleted = finished; self->_seeking = NO; }
    }];
  }
  if (!_seeking && _seekCompleted && !_ready && _imageSent && _surfaces.drawn(_seek, _imagePTS)) {
    _ready = YES; [self observe:{"paused", 0, true}];
  }
  if (_ready && _rateSequence != [_intent[@"sequence"] unsignedLongLongValue]) {
    [_engine setRate:![_intent[@"seekMode"] isEqual:@"preview"] && [_intent[@"playing"] boolValue] ? [_intent[@"rate"] floatValue] : 0];
    _rateSequence = [_intent[@"sequence"] unsignedLongLongValue];
  }
  if (!_seeking && _seekCompleted && (!_imageSent || _surfaces.demanded()) && surfacewire::hasFrameCredit(_surfaces.pending()) && _output.count() < 6) {
    // A completed same-frame seek may not make hasNewPixelBuffer true. Ask
    // AVPlayer for the image appropriate to its confirmed clock and re-present.
    CMTime pts; CVPixelBufferRef image = [_engine copyCurrentImage:&pts force:!_imageSent];
    if (image) {
      CMVideoFormatDescriptionRef format = NULL; CMSampleBufferRef sample = NULL;
      OSStatus status = CMVideoFormatDescriptionCreateForImageBuffer(NULL, image, &format);
      CMSampleTimingInfo timing = { kCMTimeInvalid, pts, kCMTimeInvalid };
      if (status == noErr) status = CMSampleBufferCreateReadyWithImageBuffer(NULL, image, format, &timing, &sample);
      CVPixelBufferRelease(image); if (format) CFRelease(format);
      require(status == noErr && sample, @"Apple image format");
      SampleOwner sampleOwner{sample};
      require(CMTIME_IS_NUMERIC(pts) && CMTimeCompare(pts, kCMTimeZero) >= 0, @"Apple image timestamp");
      uint64_t ticks = CMTimeConvertScale(pts, 120000, kCMTimeRoundingMethod_Default).value;
      uint64_t id = _surfaces.nextID();
      BOOL sent = _surfaces.send(sample, _seek, _seek, ticks);
      if (sent) {
        _imagePTS = ticks; _imageSent = YES; _surfaces.consumedDemand();
        [self enqueue:@{@"type":@"surface-ready", @"generation":_manifest[@"owner"][@"generation"], @"id":@(id)}];
      }
    }
  }
  if (CACurrentMediaTime() - _observedAt >= .033) {
    _observedAt = CACurrentMediaTime();
    BOOL waiting = _ready && _engine.timeControlStatus == AVPlayerTimeControlStatusWaitingToPlayAtSpecifiedRate;
    double requestedRate = ![_intent[@"seekMode"] isEqual:@"preview"] && [_intent[@"playing"] boolValue] ? [_intent[@"rate"] doubleValue] : 0;
    auto state = appleplayback::samplePlayerObservation(_ready, waiting, requestedRate, [&] { return _engine.rate; });
    if (state) [self observe:*state];
  }
}
- (void)close {
  if (_closing) return;
  _closing = YES; _closeAt = CACurrentMediaTime(); [_engine pause];
  if (_intent && CMTIME_IS_NUMERIC(_engine.currentTime)) _stopped = @{
    @"generation":_intent[@"generation"], @"sourceKey":_intent[@"sourceKey"],
    @"sequence":_intent[@"sequence"], @"seekId":_intent[@"seekId"],
    @"time":@(CMTimeGetSeconds(_engine.currentTime)), @"rate":@0
  };
  [_engine close];
}
- (void)persist {
  NSDictionary *result = @{@"engine":@"AVPlayer", @"success":@(!_failure), @"stoppedClock":_stopped ?: [NSNull null], @"error":_failure ?: [NSNull null]};
  NSData *data = [NSJSONSerialization dataWithJSONObject:result options:0 error:nil];
  BOOL saved = data && [data writeToFile:_result options:NSDataWritingWithoutOverwriting error:nil];
  [self enqueue:@{@"type":@"drained", @"generation":_manifest[@"owner"][@"generation"], @"nativeDrained":@YES, @"stoppedClock":_stopped ?: [NSNull null], @"resultPersisted":@(saved), @"resultSHA256":saved ? sha256(data) : @"", @"success":@(saved && !_failure), @"requiresOwnerExitZero":@YES}];
  _persisted = YES;
}
- (int)run {
  while (true) {
    // Failed pipe/Mach operations must not bypass the shutdown deadline.
    if (_closing && CACurrentMediaTime() - _closeAt > 10) return 1;
    @autoreleasepool {
      @try {
        try {
          _surfaces.poll(); [self flush];
          if (interrupted) [self close];
          if (!_closing) { [self readCommands]; if (!_closing) [self updatePlayer]; }
          if (_closing && !_surfaces.pending() && !_output.count() && !_persisted) [self persist];
          if (_persisted && !_output.count()) return _failure ? 1 : 0;
        } catch (const OutputDisconnected &) {
          [self close]; return 1;
        } catch (const std::exception &error) {
          _failure = @(error.what()); [self close];
        }
      } @catch (NSException *error) {
        _failure = error.reason; [self close];
      }
      [[NSRunLoop mainRunLoop] runUntilDate:[NSDate dateWithTimeIntervalSinceNow:.004]];
    }
  }
}
@end

int main(int argc, const char **argv) {
  @autoreleasepool {
    if (argc == 3 && !strcmp(argv[1], "--export-clip")) {
      @try { return runAppleClipExport(argv[2]); }
      @catch (NSException *) { return 1; }
    }
    if (argc != 4 || strcmp(argv[3], "--auto-no-ui-input")) return 64;
    struct stat input;
    if (fstat(STDIN_FILENO, &input) || !S_ISFIFO(input.st_mode)) return 65;
    if (fcntl(STDIN_FILENO, F_SETFL, fcntl(STDIN_FILENO, F_GETFL) | O_NONBLOCK) || fcntl(STDOUT_FILENO, F_SETFL, fcntl(STDOUT_FILENO, F_GETFL) | O_NONBLOCK)) return 65;
    signal(SIGINT, interrupt); signal(SIGTERM, interrupt); signal(SIGPIPE, SIG_IGN);
    NSData *data = [NSData dataWithContentsOfFile:@(argv[1])];
    if (!data || data.length > 65536) return 65;
    NSDictionary *manifest = [NSJSONSerialization JSONObjectWithData:data options:0 error:nil];
    if (![manifest isKindOfClass:NSDictionary.class] || ![manifest[@"source"] isKindOfClass:NSString.class] || [manifest[@"version"] intValue] != 1) return 65;
    NSString *expected = [[[@(argv[1]) stringByDeletingLastPathComponent] stringByAppendingPathComponent:@"native-run-1"] stringByAppendingPathComponent:@"native-result.json"];
    if (![[expected stringByStandardizingPath] isEqualToString:[@(argv[2]) stringByStandardizingPath]] || [[NSFileManager defaultManager] fileExistsAtPath:expected]) return 65;
    [NSApplication sharedApplication]; [NSApp setActivationPolicy:NSApplicationActivationPolicyAccessory];
    @try {
      try { return [[[STApplePlayerHost alloc] initWithManifest:manifest result:expected] run]; }
      catch (...) { return 1; }
    } @catch (NSException *) { return 1; }
  }
}
