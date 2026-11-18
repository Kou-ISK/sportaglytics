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
void waitAtAndDrain(STGroupPlayerSource *source, uint64_t ticks) {
  const double deadline = CACurrentMediaTime() + 8;
  do {
    [source pollAtGlobalTime:ticks];
    auto frame = [source frame];
    if (frame && frame->covers(ticks) && !source.imageReadInProgress) return;
    assert(!source.failed); pump();
  } while (CACurrentMediaTime() < deadline);
  assert(false);
}
void publishedStopSurvivesBankEviction(NSURL *url, appleplayback::FrameBudget &budget, bool reuse, bool closeBeforeCompletion = false, int64_t offset = 0) {
  auto audio = [[STHeldGroupAudio alloc] initWithURL:url];
  auto source = [[STGroupPlayerSource alloc] initWithURL:url globalStart:0 globalEnd:240240 - offset sourceOffset:offset
    budget:budget sourceRevision:*appleplayback::sourceFileRevision(url) audioSession:audio];
  assert([source seek:4004 operation:1]);
  double deadline = CACurrentMediaTime() + 8;
  while (!audio.heldCompletion && CACurrentMediaTime() < deadline) { [source poll]; pump(); }
  assert(audio.heldCompletion); [audio releaseCompletion]; waitAtAndDrain(source, 4004);
  auto published = [source frame]; assert(published);
  assert(![source rememberPublishedPair:0] && ![source rememberPublishedPair:9007199254740992ULL]);
  for (uint64_t pair = 1; pair <= 5; ++pair) assert([source rememberPublishedPair:pair]);
  assert(![source hasPublishedPair:1 covering:4004] && [source hasPublishedPair:2 covering:4004]);
  assert(![source hasPublishedPair:5 covering:90000] && !source.failed);
  // Three actual decoded banks evict the first picture; its published loan
  // remains owned independently, without creating new pixels or charge.
  waitAtAndDrain(source, 90000); waitAtAndDrain(source, 180000);
  assert([source hasPublishedPair:5 covering:4004]);
  assert(![source seek:4004 operation:1 publishedPair:5]);
  assert(![source seek:90000 operation:2 publishedPair:5]); // wrong interval changes nothing
  assert(reuse ? [source seek:4004 operation:2 publishedPair:5] : [source seek:4004 operation:2]);
  assert(![source hasPublishedPair:5 covering:4004] && ![source frame]);
  [source poll];
  // Deterministic ownership observation, not a sleep/latency threshold: the
  // control launches a re-decode, while the confirmed stop launches no worker.
  assert(source.imageReadInProgress == !reuse);
  deadline = CACurrentMediaTime() + 8;
  while (!audio.heldCompletion && CACurrentMediaTime() < deadline) { [source poll]; pump(); }
  assert(audio.heldCompletion && !source.seekCompleted && ![source frame]);
  if (reuse) assert(!source.imageReadInProgress);
  if (closeBeforeCompletion) {
    [source close]; assert(!source.drained && ![source frame]);
    [audio releaseCompletion]; closeAndDrain(source); return;
  }
  [audio releaseCompletion]; waitAtAndDrain(source, 4004);
  auto stopped = [source frame]; assert(stopped && stopped->sourceStart == published->sourceStart);
  if (reuse) {
    assert(stopped->image.image() == published->image.image());
    assert(!source.imageReadInProgress);
    const auto host = CMTimeAdd(CMClockGetTime(CMClockGetHostTimeClock()), CMTimeMake(1, 10));
    assert([source scheduleRate:-2 globalTicks:4004 hostTime:host]);
    [source poll];
    assert(source.imageReadInProgress && [source frame] && [source frame]->covers(4004));
    [source pause]; // only the new press starts a new bounded read
  }
  assert([source rememberPublishedPair:6]);
  assert([source seek:90000 operation:3]);
  assert(![source frame] && ![source hasPublishedPair:6 covering:4004]);
  assert(![source seek:4004 operation:4 publishedPair:6]);
  closeAndDrain(source);
}
void oldPrefetchOnRateChange(NSURL *url, appleplayback::FrameBudget &budget,
                             int initialDirection, bool reverse, bool checkReadAhead = false, bool completedBeforeTurn = false) {
  auto source = [[STGroupPlayerSource alloc] initWithURL:url globalStart:0 globalEnd:240240 sourceOffset:0
    budget:budget sourceRevision:*appleplayback::sourceFileRevision(url)];
  const uint64_t anchor = 120000;
  assert([source seek:anchor operation:1]); waitAtAndDrain(source, anchor);
  const auto start = [] { return CMTimeAdd(CMClockGetTime(CMClockGetHostTimeClock()), CMTimeMake(1,10)); };
  assert([source scheduleRate:(initialDirection < 0 ? -2 : 1) globalTicks:anchor hostTime:start()]);
  [source poll]; assert(source.imageReadInProgress);
  if (completedBeforeTurn) {
    const double deadline = CACurrentMediaTime() + 8;
    while (source.imageReadInProgress && CACurrentMediaTime() < deadline) pump();
    assert(!source.imageReadInProgress && !source.failed);
  }
  // Otherwise do not deliver old main-queue callbacks before the new control.
  [source pause]; assert([source adoptOperation:2]);
  assert([source scheduleRate:((reverse ? -initialDirection : initialDirection) < 0 ? -2 : 1) globalTicks:anchor hostTime:start()]);
  assert(source.imageReadInProgress == !completedBeforeTurn); // retirement cannot grant physical drain
  if (!checkReadAhead) [source pause];
  double deadline = CACurrentMediaTime() + 8;
  while (source.imageReadInProgress && CACurrentMediaTime() < deadline) pump();
  assert(!source.imageReadInProgress && !source.failed);
  if (checkReadAhead) {
    assert(reverse);
    [source pollAtGlobalTime:anchor];
    assert(source.imageReadInProgress && [source frame]->covers(anchor));
    [source pause];
    deadline = CACurrentMediaTime() + 8;
    while (source.imageReadInProgress && CACurrentMediaTime() < deadline) pump();
    assert(!source.imageReadInProgress && !source.failed);
    const uint64_t ahead = int64_t(anchor) - initialDirection * 48000;
    [source pollAtGlobalTime:ahead];
    assert(!source.imageReadInProgress && [source frame]->covers(ahead));
    closeAndDrain(source); assert(!budget.usedBytes());
    return;
  }
  uint64_t previouslyPrefetched = int64_t(anchor) + initialDirection * 48000;
  [source pollAtGlobalTime:previouslyPrefetched];
  assert(source.imageReadInProgress == reverse);
  waitAtAndDrain(source, previouslyPrefetched);
  closeAndDrain(source); assert(!budget.usedBytes());
}

void seekEvictsOnlyDistantImages(NSURL *url, appleplayback::FrameBudget &budget) {
  auto source = [[STGroupPlayerSource alloc] initWithURL:url globalStart:0 globalEnd:240240 sourceOffset:2002
    budget:budget sourceRevision:*appleplayback::sourceFileRevision(url)];
  assert([source seek:120000 operation:1]); waitAtAndDrain(source, 120000);
  auto external = [source frame]; assert(external);
  const uint64_t retained = budget.usedBytes();
  assert([source seek:120001 operation:2]); waitAtAndDrain(source,120001);
  assert([source frame]->image.image() == external->image.image());
  assert([source seek:20000 operation:3]);
  assert(budget.usedBytes() > 0 && budget.usedBytes() < retained);
  assert(![source frame] && external->covers(120000));
  external.reset(); assert(budget.usedBytes() == 0);
  waitAtAndDrain(source, 20000); closeAndDrain(source); assert(!budget.usedBytes());
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
  assert([second scheduleRate:-2 globalTicks:4004 hostTime:future]);
  [second pause];
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
  // A clock refill is not a user pause: retain decode direction even when the
  // fixed target just crossed the previous bank while its worker was draining.
  auto longURL = [NSURL fileURLWithPath:[directory stringByAppendingPathComponent:@"refill.mov"]];
  fixture(longURL, true, 16, 16, -1, false, 80);
  seekEvictsOnlyDistantImages(longURL,budget);
  for (int direction : {-1, 1})
    for (bool reverse : {false, true})
      oldPrefetchOnRateChange(longURL,budget,direction,reverse);
  for (int direction : {-1, 1})
    for (bool completed : {false,true})
      oldPrefetchOnRateChange(longURL,budget,direction,true,true,completed);
  for (int mode = 0; mode < 2; ++mode) {
    auto refill = [[STGroupPlayerSource alloc] initWithURL:longURL globalStart:0 globalEnd:240240 sourceOffset:0
      budget:budget sourceRevision:*appleplayback::sourceFileRevision(longURL)];
    assert([refill seek:180000 operation:1]); waitFor(refill, 180000);
    deadline = CACurrentMediaTime() + 8;
    while (refill.imageReadInProgress && CACurrentMediaTime() < deadline && !refill.failed) {
      [refill poll]; pump();
    }
    assert(!refill.failed && !refill.imageReadInProgress);
    CMTime host = CMTimeAdd(CMClockGetTime(CMClockGetHostTimeClock()), CMTimeMake(1, 10));
    assert([refill scheduleRate:-4 globalTicks:180000 hostTime:host]);
    if (mode) [refill pause]; else [refill pauseForRefill];
    // Synchronous actor transition, before yielding to the requested worker.
    // A refill keeps one bounded adjacent request; a user pause starts none.
    [refill pollAtGlobalTime:151000];
    assert(!refill.failed && refill.imageReadInProgress == (mode == 0));
    assert([refill frame] && [refill frame]->covers(151000));
    deadline = CACurrentMediaTime() + 8;
    while (refill.imageReadInProgress && CACurrentMediaTime() < deadline && !refill.failed) {
      [refill pollAtGlobalTime:151000]; pump();
    }
    assert(!refill.failed && !refill.imageReadInProgress);
    for (int repeat = 0; repeat < 10; ++repeat) [refill pollAtGlobalTime:151000];
    assert(!refill.imageReadInProgress); // no second bank beyond one fixed target
    [refill pause]; closeAndDrain(refill); assert(!budget.usedBytes());
  }
  auto stopURL = [NSURL fileURLWithPath:[directory stringByAppendingPathComponent:@"published-stop.mov"]];
  fixture(stopURL, true, 16, 16, -1, true, 80);
  publishedStopSurvivesBankEviction(stopURL, budget, false); assert(!budget.usedBytes());
  publishedStopSurvivesBankEviction(stopURL, budget, true); assert(!budget.usedBytes());
  publishedStopSurvivesBankEviction(stopURL, budget, true, true); assert(!budget.usedBytes());
  publishedStopSurvivesBankEviction(stopURL, budget, true, false, 2002); assert(!budget.usedBytes());
  // A pin never grants access to a replaced source, even while its old image
  // loan still exists. Only this test's generated fixtures are renamed.
  auto pinURL = [NSURL fileURLWithPath:[directory stringByAppendingPathComponent:@"pin-source.mov"]];
  fixture(pinURL, true);
  auto changedPin = [[STGroupPlayerSource alloc] initWithURL:pinURL globalStart:0 globalEnd:24024 sourceOffset:0
    budget:budget sourceRevision:*appleplayback::sourceFileRevision(pinURL)];
  assert([changedPin seek:4004 operation:1]); waitFor(changedPin, 4004);
  assert([changedPin rememberPublishedPair:1]);
  auto movedPin = [directory stringByAppendingPathComponent:@"pin-before-replacement.mov"];
  assert([[NSFileManager defaultManager] moveItemAtPath:pinURL.path toPath:movedPin error:nil]);
  fixture(pinURL, true);
  assert(![changedPin hasPublishedPair:1 covering:4004] && changedPin.failed && ![changedPin frame]);
  assert(changedPin.error.code == 2 && [changedPin.error.userInfo[NSUnderlyingErrorKey] code] == 10);
  closeAndDrain(changedPin); assert(!budget.usedBytes());
  // Remove only this fixture owned by this process, after actual index drainage.
  assert([[NSFileManager defaultManager] removeItemAtPath:directory error:nil]);
  puts("group real-player source intervals/offsets/ownership passed");
} }
