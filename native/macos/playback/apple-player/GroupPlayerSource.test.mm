#import "SampleIntervalFixture.hpp"
#import "GroupPlayerSource.hpp"
#include <cstdio>

@interface STHeldGroupAudio : STApplePlayerSession
@property(nonatomic, copy) void (^heldCompletion)(void);
@property(nonatomic) BOOL holdReadiness;
- (void)releaseCompletion;
@end
@implementation STHeldGroupAudio
- (AVPlayerItemStatus)status { return self.holdReadiness ? AVPlayerItemStatusUnknown : [super status]; }
- (void)seekToTime:(CMTime)time approximate:(BOOL)approximate completion:(void (^)(BOOL))completion {
  [super seekToTime:time approximate:approximate completion:^(BOOL finished) {
    self.heldCompletion = ^{ completion(finished); };
  }];
}
- (void)releaseCompletion {
  auto completion = self.heldCompletion; self.heldCompletion = nil;
  assert(completion); completion();
}
@end

void waitFor(STGroupPlayerSource *source, uint64_t target) {
  double deadline = CACurrentMediaTime() + 12;
  while (CACurrentMediaTime() < deadline && !source.failed) {
    [source poll]; auto image = [source frame];
    if (source.seekCompleted && image && image->covers(target)) return;
    pump();
  }
  fprintf(stderr, "group source failed code=%ld\n", (long)source.error.code);
  assert(false);
}
void closeAndDrain(STGroupPlayerSource *source) {
  [source close];
  double deadline = CACurrentMediaTime() + 4;
  while (!source.drained && CACurrentMediaTime() < deadline) pump();
  assert(source.drained && ![source frame]);
}
int main() { @autoreleasepool {
  NSString *directory = [NSTemporaryDirectory() stringByAppendingPathComponent:
    [@"sportag-group-source-" stringByAppendingString:NSUUID.UUID.UUIDString]];
  assert([[NSFileManager defaultManager] createDirectoryAtPath:directory withIntermediateDirectories:NO attributes:nil error:nil]);
  NSURL *url = [NSURL fileURLWithPath:[directory stringByAppendingPathComponent:@"vfr.mov"]]; fixture(url, true, 16, 16, -1, true);
  appleplayback::FrameBudget budget(64 * 1024 * 1024);
  auto first = [[STGroupPlayerSource alloc] initWithURL:url globalStart:0 globalEnd:24024 sourceOffset:0 budget:budget sourceRevision:*appleplayback::sourceFileRevision(url)];
  // The second independent player has a non-zero placement offset. A source
  // sample's PTS must never be re-labelled as the same global clock.
  auto second = [[STGroupPlayerSource alloc] initWithURL:url globalStart:0 globalEnd:22022 sourceOffset:2002 budget:budget sourceRevision:*appleplayback::sourceFileRevision(url)];
  assert([first seek:4004 operation:1] && [second seek:4004 operation:1]);
  waitFor(first, 4004); waitFor(second, 4004);
  {
    auto a = [first frame], b = [second frame];
    assert(a && b && a->sourceStart == 2002 && b->sourceStart == 6006);
    assert(a->globalStart == 2002 && a->globalEnd == 6006);
    assert(b->globalStart == 4004 && b->globalEnd == 6006);
    assert(!a->covers(6006) && !b->covers(6006));
    assert(budget.usedBytes() > 0 && !budget.quarantinedBytes());
    // New seek invalidates local frames immediately. The old immutable loan
    // still owns a charge until this scope ends; closing cannot invent release.
    assert([first seek:8008 operation:2]);
    assert(![first frame] && ![first seek:8008 operation:2]);
    closeAndDrain(first);
    assert(a->image.image() && budget.usedBytes() > 0);
  }
  CMTime future = CMTimeAdd(CMClockGetTime(CMClockGetHostTimeClock()), CMTimeMake(1, 10));
  assert(![second scheduleRate:-2 globalTicks:4004 hostTime:future]);
  // One source closing must not revoke the other player's image/metadata.
  assert([second frame] && [second frame]->covers(4004));
  assert(![second seek:22022 operation:2]);
  assert(![second scheduleRate:1 globalTicks:0 hostTime:CMClockGetTime(CMClockGetHostTimeClock())]);
  closeAndDrain(second); assert(budget.usedBytes() == 0);
  // Pending old callback cannot revive a new operation or a closed source.
  auto changed = [[STGroupPlayerSource alloc] initWithURL:url globalStart:0 globalEnd:24024 sourceOffset:0 budget:budget sourceRevision:*appleplayback::sourceFileRevision(url)];
  assert([changed seek:0 operation:1]); [changed poll];
  assert([changed adoptOperation:2]); waitFor(changed, 0);
  assert([changed seek:8008 operation:3]); waitFor(changed, 8008);
  closeAndDrain(changed); pump(); assert(![changed frame] && budget.usedBytes() == 0);
  auto absent = [[STGroupPlayerSource alloc] initWithURL:
    [NSURL fileURLWithPath:[directory stringByAppendingPathComponent:@"missing.mov"]]
    globalStart:0 globalEnd:24024 sourceOffset:0 budget:budget sourceRevision:*appleplayback::sourceFileRevision(url)];
  assert([absent seek:0 operation:1]);
  double deadline = CACurrentMediaTime() + 12;
  while (!absent.failed && CACurrentMediaTime() < deadline) { [absent poll]; pump(); }
  assert(absent.failed && ![absent frame]); closeAndDrain(absent);
  appleplayback::FrameBudget tiny(1);
  auto limited = [[STGroupPlayerSource alloc] initWithURL:url globalStart:0 globalEnd:24024 sourceOffset:0 budget:tiny sourceRevision:*appleplayback::sourceFileRevision(url)];
  assert([limited seek:4004 operation:1]); deadline = CACurrentMediaTime() + 12;
  while (!limited.failed && CACurrentMediaTime() < deadline) { [limited poll]; pump(); }
  assert(limited.failed && limited.error.code == 2 && [limited.error.userInfo[NSUnderlyingErrorKey] code] == 9 && ![limited frame]);
  closeAndDrain(limited); assert(tiny.usedBytes() == 0 && !tiny.quarantinedBytes());
  // Close while a seek completion is queued: drain waits for that callback,
  // and its late arrival must not revive a closed source.
  auto closing = [[STGroupPlayerSource alloc] initWithURL:url globalStart:0 globalEnd:24024 sourceOffset:0 budget:budget sourceRevision:*appleplayback::sourceFileRevision(url)];
  assert([closing seek:0 operation:1]); [closing poll]; closeAndDrain(closing);
  pump(); assert(![closing frame] && budget.usedBytes() == 0);
  auto silentURL = [NSURL fileURLWithPath:[directory stringByAppendingPathComponent:@"silent.mov"]];
  fixture(silentURL, true);
  auto silent = [[STGroupPlayerSource alloc] initWithURL:silentURL globalStart:0 globalEnd:24024 sourceOffset:0 budget:budget sourceRevision:*appleplayback::sourceFileRevision(silentURL)];
  assert([silent seek:4004 operation:1]); waitFor(silent, 4004);
  assert([silent selectAudioTrack:0 volume:0 muted:YES] && ![silent selectAudioTrack:1 volume:0 muted:YES]);
  closeAndDrain(silent); assert(budget.usedBytes() == 0);
  // Hold only delivery of a real AVPlayer seek completion. Decoding must
  // start independently, while pair readiness still waits for that completion.
  for (bool closeBeforeCompletion : {false, true}) {
    auto audio = [[STHeldGroupAudio alloc] initWithURL:url];
    audio.holdReadiness = YES;
    auto gated = [[STGroupPlayerSource alloc] initWithURL:url globalStart:0 globalEnd:24024 sourceOffset:0
      budget:budget sourceRevision:*appleplayback::sourceFileRevision(url) audioSession:audio];
    assert([gated seek:4004 operation:1]); deadline = CACurrentMediaTime() + 12;
    while (!budget.usedBytes() && CACurrentMediaTime() < deadline && !gated.failed) { [gated poll]; pump(); }
    assert(budget.usedBytes() > 0 && !gated.failed && !audio.heldCompletion && ![gated frame]);
    audio.holdReadiness = NO;
    while ((!audio.heldCompletion || !budget.usedBytes()) && CACurrentMediaTime() < deadline && !gated.failed) {
      [gated poll]; pump();
    }
    assert(audio.heldCompletion && budget.usedBytes() > 0 && !gated.failed);
    assert(!gated.seekCompleted && ![gated frame]);
    if (closeBeforeCompletion) { [gated close]; assert(!gated.drained); }
    [audio releaseCompletion];
    if (!closeBeforeCompletion) waitFor(gated, 4004);
    closeAndDrain(gated); assert(budget.usedBytes() == 0);
  }
  // Remove only this fixture owned by this process, after actual index drainage.
  assert([[NSFileManager defaultManager] removeItemAtPath:directory error:nil]);
  puts("group real-player source intervals/offsets/ownership passed");
} }
