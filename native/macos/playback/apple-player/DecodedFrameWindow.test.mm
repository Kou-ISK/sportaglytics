#import "DecodedFrameReferenceFixture.hpp"
#import "DecodedFrameWindow.hpp"
#import "DecodeAnchor.hpp"
#include "TrackEditTime.hpp"
#include <cstdio>
void wait(STDecodedFrameWindow *decoder) {
  double end = CACurrentMediaTime() + 7;
  while (!decoder.drained && CACurrentMediaTime() < end) pump();
  assert(decoder.drained);
}
int main() { @autoreleasepool {
  NSString *directory = [NSTemporaryDirectory() stringByAppendingPathComponent:[@"sportag-decoded-window-" stringByAppendingString:NSUUID.UUID.UUIDString]];
  assert([[NSFileManager defaultManager] createDirectoryAtPath:directory withIntermediateDirectories:NO attributes:nil error:nil]);
  NSURL *url = [NSURL fileURLWithPath:[directory stringByAppendingPathComponent:@"distinct-vfr.mov"]]; fixture(url, true);
  auto asset = [AVURLAsset URLAssetWithURL:url options:nil];
  __block NSArray<AVAssetTrack *> *tracks = nil;
  [asset loadTracksWithMediaType:AVMediaTypeVideo completionHandler:^(NSArray<AVAssetTrack *> *loaded, NSError *error) {
    assert(!error); dispatch_async(dispatch_get_main_queue(), ^{ tracks = loaded; });
  }];
  const double trackDeadline = CACurrentMediaTime() + 4;
  while (!tracks && CACurrentMediaTime() < trackDeadline) pump();
  assert(tracks.count == 1);
  // The cursor selects the actual VFR containing sample, not the requested
  // timestamp. Exact boundaries stay exact; cancellation retains the fallback.
  auto chosen = appleplayback::decodeAnchor(tracks.firstObject, CMTimeMake(4004, 120000), kCMTimeZero, [] { return false; });
  assert(appleplayback::sourceTicks(chosen) == 2002);
  chosen = appleplayback::decodeAnchor(tracks.firstObject, CMTimeMake(6006, 120000), kCMTimeZero, [] { return false; });
  assert(appleplayback::sourceTicks(chosen) == 6006);
  chosen = appleplayback::decodeAnchor(tracks.firstObject, CMTimeMake(6006, 120000), kCMTimeZero, [] { return true; });
  assert(CMTimeCompare(chosen, kCMTimeZero) == 0);
  appleplayback::FrameBudget budget(64 * 1024 * 1024);
  const uint8_t secondSampleLuma = referenceComponent(directory, 16, 16, 60);
  auto decoder = [[STDecodedFrameWindow alloc] initWithURL:url budget:budget sourceRevision:*appleplayback::sourceFileRevision(url)];
  assert([decoder requestStart:0 end:24024] && ![decoder requestStart:0 end:24024]); wait(decoder);
  if (decoder.failed) fprintf(stderr, "decoder code=%ld underlying=%ld\n", (long)decoder.error.code, (long)[decoder.error.userInfo[NSUnderlyingErrorKey] code]);
  assert(!decoder.failed);
  {
    auto first = [decoder select:4004], second = [decoder select:6006];
    assert(first && second && std::llround(first->pts() * 120000) == 2002 && std::llround(first->end() * 120000) == 6006);
    assert(std::llround(second->pts() * 120000) == 6006 && std::llround(second->end() * 120000) == 8008);
    assert(![decoder select:24024]);
    assert(CVPixelBufferLockBaseAddress(first->image(), kCVPixelBufferLock_ReadOnly) == kCVReturnSuccess);
    const auto y = *static_cast<const uint8_t *>(CVPixelBufferGetBaseAddressOfPlane(first->image(), 0));
    // JPEG's coded full-range component is returned by this decoder, unlike
    // AVPlayer's colour-converted output. This test identifies the original
    // distinct sample; it is not general BT.709/limited-range qualification.
    assert(y == secondSampleLuma);
    CVPixelBufferUnlockBaseAddress(first->image(), kCVPixelBufferLock_ReadOnly);
    [decoder close]; assert(decoder.drained && ![decoder select:4004] && budget.usedBytes() > 0);
  }
  assert(budget.usedBytes() == 0);
  auto banks = [[STDecodedFrameWindow alloc] initWithURL:url budget:budget sourceRevision:*appleplayback::sourceFileRevision(url)];
  assert([banks requestStart:0 end:8008]); wait(banks);
  {
    auto loan = [banks select:4004]; assert(loan);
    const auto firstBytes = budget.usedBytes();
    assert([banks requestStart:8008 end:16016]);
    assert([banks select:4004]); // preceding bank survives pending decode
    wait(banks); assert(!banks.failed && [banks select:10010] && [banks select:4004]);
    assert(budget.usedBytes() > firstBytes);
    assert([banks requestStart:16016 end:24024]); wait(banks);
    assert(!banks.failed && ![banks select:4004] && [banks select:10010] && [banks select:18018]);
    assert(loan->image()); // eviction cannot refund an external image loan
    [banks close]; assert(banks.drained && budget.usedBytes() > 0);
  }
  assert(budget.usedBytes() == 0);
  auto cancelled = [[STDecodedFrameWindow alloc] initWithURL:url budget:budget sourceRevision:*appleplayback::sourceFileRevision(url)];
  auto other = [[STDecodedFrameWindow alloc] initWithURL:url budget:budget sourceRevision:*appleplayback::sourceFileRevision(url)];
  assert([cancelled requestStart:0 end:24024] && [other requestStart:0 end:24024]);
  [cancelled invalidate]; wait(cancelled); wait(other);
  assert(![cancelled select:4004] && !cancelled.failed && [other select:4004]);
  [cancelled close]; [other close]; assert(budget.usedBytes() == 0);
  // Exact coarse-clock timing is retained instead of inventing the input PTS.
  auto coarseURL = [NSURL fileURLWithPath:[directory stringByAppendingPathComponent:@"coarse.mov"]];
  fixture(coarseURL, false);
  auto coarse = [[STDecodedFrameWindow alloc] initWithURL:coarseURL budget:budget sourceRevision:*appleplayback::sourceFileRevision(coarseURL)];
  assert([coarse requestStart:0 end:24000]); wait(coarse);
  { auto image = [coarse select:2001]; assert(image && std::llround(image->pts() * 120000) == 2000); }
  [coarse close]; assert(budget.usedBytes() == 0);
  // The writer drops the first interval from the presentation timeline.
  auto editedURL = [NSURL fileURLWithPath:[directory stringByAppendingPathComponent:@"translated.mov"]];
  fixture(editedURL, true, 16, 16, -1, false, 8, 2002);
  auto edited = [[STDecodedFrameWindow alloc] initWithURL:editedURL budget:budget sourceRevision:*appleplayback::sourceFileRevision(editedURL)];
  assert([edited requestStart:0 end:4004]); wait(edited);
  { auto first = [edited select:0]; assert(!edited.failed && first && first->pts() == 0 && llround(first->end()*120000) == 4004);
    assert(CVPixelBufferLockBaseAddress(first->image(), kCVPixelBufferLock_ReadOnly) == 0);
    const auto actual = *static_cast<const uint8_t*>(CVPixelBufferGetBaseAddressOfPlane(first->image(), 0));
    CVPixelBufferUnlockBaseAddress(first->image(), kCVPixelBufferLock_ReadOnly);
    assert(actual == secondSampleLuma); }
  [edited close]; assert(budget.usedBytes() == 0);
  const auto time = [](int value) { return CMTimeMake(value, 120000); };
  const CMTimeMapping mapping{CMTimeRangeMake(time(2002), time(8008)), CMTimeRangeMake(time(0), time(8008))};
  assert(appleplayback::matchesUnitRateEdit(mapping, time(2002), time(4004), time(0), time(4004)));
  assert(!appleplayback::matchesUnitRateEdit(mapping, time(2001), time(4004), time(0), time(4004)));
  assert(!appleplayback::matchesUnitRateEdit(mapping, time(8008), time(4004), time(6006), time(4004)));
  assert(!appleplayback::matchesUnitRateEdit(mapping, time(2002), time(4004), time(1), time(4004)));
  assert(!appleplayback::matchesUnitRateEdit(mapping, time(2002), time(4004), time(0), time(2002)));
  assert(!appleplayback::matchesUnitRateEdit({mapping.source,CMTimeRangeMake(time(0),time(16016))},
                                             time(2002), time(4004), time(0), time(4004)));
  auto replacement = [NSURL fileURLWithPath:[directory stringByAppendingPathComponent:@"replacement.mov"]]; fixture(replacement, true);
  auto originalRevision = *appleplayback::sourceFileRevision(url);
  auto changed = [[STDecodedFrameWindow alloc] initWithURL:url budget:budget sourceRevision:originalRevision];
  assert([changed requestStart:0 end:24024]);
  // No run-loop yield: any queued old progress must recheck Main's identity
  // before adopting pixels. This is normal replacement, not an adversarial OS guarantee.
  auto backup = [directory stringByAppendingPathComponent:@"before-replacement.mov"];
  assert([[NSFileManager defaultManager] moveItemAtPath:url.path toPath:backup error:nil]);
  assert([[NSFileManager defaultManager] moveItemAtPath:replacement.path toPath:url.path error:nil]);
  wait(changed); assert(changed.failed && changed.error.code == 10 && ![changed select:4004]);
  [changed close]; assert(budget.usedBytes() == 0);
  auto missingURL = [NSURL fileURLWithPath:[directory stringByAppendingPathComponent:@"missing.mov"]];
  auto missing = [[STDecodedFrameWindow alloc] initWithURL:missingURL budget:budget sourceRevision:originalRevision];
  assert([missing requestStart:0 end:24024]); wait(missing);
  assert(missing.failed && missing.error.code == 10 && ![missing select:4004]);
  [missing close]; assert(budget.usedBytes() == 0);
  appleplayback::FrameBudget tiny(1);
  auto limited = [[STDecodedFrameWindow alloc] initWithURL:url budget:tiny sourceRevision:*appleplayback::sourceFileRevision(url)];
  assert([limited requestStart:0 end:24024]); wait(limited);
  assert(limited.failed && ![limited select:4004]); [limited close]; assert(tiny.usedBytes() == 0);
  assert([[NSFileManager defaultManager] removeItemAtPath:directory error:nil]);
  puts("DecodedFrameWindow actual sample/image, VFR, loan budget, independent cancel passed");
} }
