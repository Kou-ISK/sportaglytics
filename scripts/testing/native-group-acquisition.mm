#import "ApplePlayerSession.hpp"
#import <AVFoundation/AVFoundation.h>
#import <CoreVideo/CoreVideo.h>
#import <Foundation/Foundation.h>
#import <QuartzCore/QuartzCore.h>
#include <algorithm>
#include <cmath>
#include <sys/resource.h>
#include <vector>
#include <cstring>
#include "active-nv12-digest.hpp"

// Compute-only probe: no NSApplication, window, input synthesis or display
// claims.
static double now() { return CACurrentMediaTime(); }
static void pump(double seconds) {
  const double end = now() + seconds;
  while (now() < end)
    [[NSRunLoop currentRunLoop]
        runUntilDate:[NSDate dateWithTimeIntervalSinceNow:0.003]];
}
static id number(double value) {
  return std::isfinite(value) ? @(value) : NSNull.null;
}
static NSArray *errors(NSError *error) {
  NSMutableArray *result = [NSMutableArray array];
  for (int i = 0; error && i < 8; i++) {
    [result addObject:@{@"domain" : error.domain, @"code" : @(error.code)}];
    id next = error.userInfo[NSUnderlyingErrorKey];
    error = [next isKindOfClass:NSError.class] ? next : nil;
  }
  return result;
}
struct Sample {
  double pts = NAN, acquired = 0;
  playbackdiagnostic::ActivePixelDigest digest{};
};
static Sample sample(STApplePlayerSession *player, bool force = false) {
  Sample result;
  CMTime pts = kCMTimeInvalid;
  CVPixelBufferRef buffer = [player copyCurrentImage:&pts force:force];
  if (!buffer)
    return result;
  result.pts = CMTimeGetSeconds(pts);
  result.acquired = now();
  const auto digest = playbackdiagnostic::activeNV12Digest(buffer);
  CVPixelBufferRelease(buffer);
  if (!digest) return Sample{};
  result.digest = *digest;
  return result;
}
static NSString *digestText(const playbackdiagnostic::ActivePixelDigest &digest) {
  NSMutableString *text = [NSMutableString stringWithCapacity:digest.size() * 2];
  for (const auto byte : digest) [text appendFormat:@"%02x", static_cast<unsigned>(byte)];
  return text;
}
static double cpuSeconds() {
  rusage r{};
  getrusage(RUSAGE_SELF, &r);
  return r.ru_utime.tv_sec + r.ru_utime.tv_usec / 1e6 + r.ru_stime.tv_sec +
         r.ru_stime.tv_usec / 1e6;
}
static NSDictionary *run(NSString *source, int count, bool scheduled,
                         float rate, double offset, int repeats) {
  NSMutableArray<STApplePlayerSession *> *players = [NSMutableArray array];
  NSMutableArray *trials = [NSMutableArray array];
  double setupStart = now();
  for (int i = 0; i < count; i++) {
    STApplePlayerSession *player = [[STApplePlayerSession alloc]
        initWithURL:[NSURL fileURLWithPath:source]];
    [players addObject:player];
  }
  double deadline = now() + 8;
  while (now() < deadline) {
    bool ready = true, failed = false;
    for (STApplePlayerSession *p in players) {
      ready &= p.status == AVPlayerItemStatusReadyToPlay;
      failed |= p.status == AVPlayerItemStatusFailed;
    }
    if (ready || failed)
      break;
    pump(0.005);
  }
  NSMutableArray *capabilities = [NSMutableArray array];
  bool ready = true, supported = true;
  for (STApplePlayerSession *p in players) {
    bool allows = [p supportsRate:rate];
    ready &= p.status == AVPlayerItemStatusReadyToPlay;
    supported &= allows;
    [capabilities addObject:@{
      @"status" : @(p.status),
      @"requestedRateSupported" : @(allows),
      @"errors" : errors(p.error)
    }];
  }
  double readySeconds = now() - setupStart;
  if (ready && supported)
    for (int trial = 0; trial < repeats; trial++) {
      __block int completed = 0, previousCompleted = 0;
      __block bool seeksOK = true, previousRejected = true;
      for (int i = 0; i < count; i++) {
        STApplePlayerSession *p = players[i];
        [p pause];
        [p seekToTime:CMTimeMakeWithSeconds(20 + i * offset + .1, 60000)
            approximate:NO
             completion:^(BOOL finished) {
               previousRejected &= !finished;
               previousCompleted++;
             }];
        [p seekToTime:CMTimeMakeWithSeconds(20 + i * offset, 60000)
            approximate:NO
             completion:^(BOOL finished) {
               dispatch_async(dispatch_get_main_queue(), ^{
                 seeksOK &= bool(finished);
                 completed++;
               });
             }];
      }
      CMTime future = CMTimeAdd(CMClockGetTime(CMClockGetHostTimeClock()),
                                CMTimeMakeWithSeconds(1, 60000));
      for (STApplePlayerSession *p in players) {
        if ([p scheduleRate:rate
                   fromTime:CMTimeMakeWithSeconds(20, 60000)
                 atHostTime:future])
          return @{@"error" : @"pending-seek-accepted"};
      }
      deadline = now() + 4;
      while ((completed < count || previousCompleted < count) &&
             now() < deadline)
        pump(.005);
      if (completed != count || previousCompleted != count ||
          !previousRejected || !seeksOK) {
        [trials addObject:@{
          @"trial" : @(trial),
          @"error" : @"baseline-seek-unconfirmed"
        }];
        break;
      }
      std::vector<Sample> baseline(count), last(count);
      deadline = now() + 2;
      while (now() < deadline) {
        bool all = true;
        for (int i = 0; i < count; i++) {
          Sample s = sample(players[i], true);
          if (std::isfinite(s.pts) && fabs(s.pts - (20 + i * offset)) < .05)
            baseline[i] = s;
          all &= std::isfinite(baseline[i].pts);
        }
        if (all)
          break;
        pump(.005);
      }
      bool all = true;
      for (auto s : baseline)
        all &= std::isfinite(s.pts);
      if (!all) {
        [trials addObject:@{
          @"trial" : @(trial),
          @"error" : @"baseline-image-unconfirmed"
        }];
        break;
      }
      // Drain baseline callbacks without treating the previous seek image as a
      // new operation.
      pump(.1);
      for (int i = 0; i < count; i++) {
        Sample s = sample(players[i], true);
        if (std::isfinite(s.pts))
          baseline[i] = s;
        last[i] = baseline[i];
      }
      std::vector<double> first(count, NAN), lastNew(count, 0),
          maxGap(count, 0);
      std::vector<int> frames(count, 0), contentChanges(count, 0),
          lateFrames(count, 0);
      NSMutableArray *events = [NSMutableArray array];
      CMTime invalid = kCMTimeInvalid;
      CMTime before = CMTimeSubtract(CMClockGetTime(CMClockGetHostTimeClock()),
                                     CMTimeMakeWithSeconds(1, 60000));
      CMTime validHost = CMTimeAdd(CMClockGetTime(CMClockGetHostTimeClock()),
                                   CMTimeMakeWithSeconds(1, 60000));
      for (STApplePlayerSession *p in players) {
        if ([p scheduleRate:NAN fromTime:kCMTimeZero atHostTime:validHost] ||
            [p scheduleRate:rate fromTime:invalid atHostTime:validHost] ||
            [p scheduleRate:rate fromTime:kCMTimeZero atHostTime:before])
          return @{@"error" : @"invalid-schedule-accepted"};
      }
      double cpuStart = cpuSeconds(), commandAt = now();
      CMTime host = CMTimeAdd(CMClockGetTime(CMClockGetHostTimeClock()),
                              CMTimeMakeWithSeconds(.1, 1000000000));
      double scheduledAt = scheduled ? commandAt + .1 : commandAt;
      @try {
        for (int i = 0; i < count; i++) {
          if (scheduled) {
            if (![players[i]
                    scheduleRate:rate
                        fromTime:CMTimeMakeWithSeconds(20 + i * offset, 60000)
                      atHostTime:host]) {
              for (STApplePlayerSession *p in players)
                [p pause];
              return @{@"error" : @"product-session-rejected-schedule"};
            }
          } else
            [players[i] setRate:rate];
        }
      } @catch (NSException *e) {
        [trials addObject:@{
          @"trial" : @(trial),
          @"error" : @"set-rate-exception"
        }];
        break;
      }
      double peakPairSkew = 0, peakAllPairSkew = 0, maxImageAge = 0,
             maxClockImageLag = 0;
      int pairCount = 0, allPairPolls = 0;
      deadline = commandAt + 1.6;
      while (now() < deadline) {
        bool both = true;
        for (int i = 0; i < count; i++) {
          Sample s = sample(players[i]);
          bool changed =
              std::isfinite(s.pts) && fabs(s.pts - last[i].pts) > 1e-6;
          both &= changed;
          if (std::isfinite(last[i].pts) && now() >= scheduledAt) {
            maxImageAge = std::max(maxImageAge, now() - last[i].acquired);
            maxClockImageLag = std::max(
                maxClockImageLag,
                fabs(CMTimeGetSeconds(players[i].currentTime) - last[i].pts));
          }
          if (!changed)
            continue;
          if (s.acquired < scheduledAt) {
            last[i] = s;
            continue;
          }
          frames[i]++;
          if (s.digest != last[i].digest)
            contentChanges[i]++;
          bool backwards = rate < 0 ? s.pts < baseline[i].pts - 1e-6
                                    : s.pts > baseline[i].pts + 1e-6;
          if (backwards && s.digest != baseline[i].digest &&
              !std::isfinite(first[i]))
            first[i] = s.acquired - commandAt;
          if (lastNew[i])
            maxGap[i] = std::max(maxGap[i], s.acquired - lastNew[i]);
          lastNew[i] = s.acquired;
          last[i] = s;
          if (events.count < 600)
            [events addObject:@{
              @"angle" : @(i),
              @"hostMs" : @((s.acquired - commandAt) * 1000),
              @"pts" : @(s.pts),
              @"contentHash" : digestText(s.digest)
            }];
        }
        if (count == 2 && both) {
          peakPairSkew = std::max(peakPairSkew,
                                  fabs(last[0].pts - (last[1].pts - offset)));
          pairCount++;
        }
        if (count == 2 && now() >= scheduledAt && std::isfinite(last[0].pts) &&
            std::isfinite(last[1].pts)) {
          peakAllPairSkew = std::max(
              peakAllPairSkew, fabs(last[0].pts - (last[1].pts - offset)));
          allPairPolls++;
        }
        pump(.005);
      }
      double stopAt = now();
      NSMutableArray *clocksAtStop = [NSMutableArray array];
      for (STApplePlayerSession *p in players) {
        [clocksAtStop addObject:number(CMTimeGetSeconds(p.currentTime))];
        [p pause];
      }
      deadline = stopAt + .3;
      while (now() < deadline) {
        for (int i = 0; i < count; i++) {
          Sample s = sample(players[i]);
          if (std::isfinite(s.pts) && fabs(s.pts - last[i].pts) > 1e-6) {
            lateFrames[i]++;
            last[i] = s;
          }
        }
        pump(.005);
      }
      NSMutableArray *angles = [NSMutableArray array];
      for (int i = 0; i < count; i++)
        [angles addObject:@{
          @"angle" : @(i),
          @"firstNewImageMs" : number(first[i] * 1000),
          @"baselinePTS" : number(baseline[i].pts),
          @"lastAcquiredPTS" : number(last[i].pts),
          @"newPTSCount" : @(frames[i]),
          @"changedContentCount" : @(contentChanges[i]),
          @"maximumObservedAcquisitionGapMs" : @(maxGap[i] * 1000),
          @"postPauseAcquiredImages" : @(lateFrames[i]),
          @"clockAtPause" : clocksAtStop[i],
          @"clockAfterPause" : number(CMTimeGetSeconds(players[i].currentTime)),
          @"rateAfterPause" : @(players[i].rate)
        }];
      rusage memory{};
      getrusage(RUSAGE_SELF, &memory);
      [trials addObject:@{
        @"trial" : @(trial),
        @"freshItem" : @(trial == 0),
        @"commandHost" : @(commandAt),
        @"scheduledHost" : @(scheduledAt),
        @"stopHost" : @(stopAt),
        @"processCPUSeconds" : @(cpuSeconds() - cpuStart),
        @"processPeakRSSBytes" : @(memory.ru_maxrss),
        @"freshPairSamples" : @(pairCount),
        @"allPairPolls" : @(allPairPolls),
        @"peakLatestPairSkewSeconds" : @(peakAllPairSkew),
        @"maximumLatestImageAgeMs" : @(maxImageAge * 1000),
        @"maximumClockImageLagSeconds" : @(maxClockImageLag),
        @"peakObservedAcquiredPairSkewSeconds" : @(peakPairSkew),
        @"angles" : angles,
        @"events" : events
      }];
    }
  for (STApplePlayerSession *p in players) {
    [p close];
    if ([p scheduleRate:rate
               fromTime:kCMTimeZero
             atHostTime:CMTimeAdd(CMClockGetTime(CMClockGetHostTimeClock()),
                                  CMTimeMakeWithSeconds(1, 60000))])
      return @{@"error" : @"closed-session-accepted"};
  }
  BOOL success = ready && supported && trials.count == (NSUInteger)repeats;
  for (NSDictionary *row in trials)
    if (row[@"error"])
      success = NO;
  return @{
    @"success" : @(success),
    @"successMeaning" : @"bounded diagnostic completed, not presentation acceptance",
    @"contentFingerprint" : @"active-nv12-sha256-v1; format/dimensions and all active bytes; excludes row padding; maximum 4096x2160",
    @"players" : @(count),
    @"mode" : scheduled ? @"common-host-clock" : @"independent-rate",
    @"rate" : @(rate),
    @"offset" : @(offset),
    @"readySeconds" : @(readySeconds),
    @"capabilities" : capabilities,
    @"trials" : trials,
    @"scope" : @"actual product STApplePlayerSession; compute-only NV12 "
               @"acquisition; NOT on-screen presentation, audible sync, "
               @"whole-machine CPU/GPU or cold OS/disk cache; audio muted"
  };
}
int main(int argc, const char **argv) {
  @autoreleasepool {
    if (argc != 7)
      return 2;
    NSString *source = [NSString stringWithUTF8String:argv[1]];
    int count = atoi(argv[2]);
    float rate = atof(argv[3]);
    bool scheduled = strcmp(argv[4], "scheduled") == 0;
    if (!scheduled && strcmp(argv[4], "independent") != 0)
      return 2;
    double offset = atof(argv[5]);
    int repeats = atoi(argv[6]);
    if (!NSFileManager.defaultManager ||
        ![[NSFileManager defaultManager] fileExistsAtPath:source] ||
        count < 1 || count > 2 ||
        !(rate == 1 || rate == -.5 || rate == -2 || rate == -4 || rate == -6) ||
        !std::isfinite(offset) || fabs(offset) > 1 || repeats < 1 ||
        repeats > 3)
      return 2;
    NSDictionary *result = run(source, count, scheduled, rate, offset, repeats);
    NSError *error = nil;
    NSData *data =
        [NSJSONSerialization dataWithJSONObject:result
                                        options:NSJSONWritingPrettyPrinted
                                          error:&error];
    if (!data) {
      fprintf(stderr, "JSON_ERROR\n");
      return 3;
    }
    fwrite(data.bytes, 1, data.length, stdout);
    fputc('\n', stdout);
    return [result[@"success"] boolValue] ? 0 : 1;
  }
}
