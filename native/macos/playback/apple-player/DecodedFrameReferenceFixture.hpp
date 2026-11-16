#pragma once
#import "SampleIntervalFixture.hpp"
#import "DecodedFrameWindow.hpp"
/// Known constant-content reference. Do not assume AVPlayer and VT use the
/// same JPEG colour conversion, or that it is invariant across dimensions/OS.
/// Matching this content still catches selecting a different numbered sample.
inline uint8_t referenceComponent(NSString *directory, int width, int height, int grey) {
  auto url = [NSURL fileURLWithPath:[directory stringByAppendingPathComponent:
    [NSString stringWithFormat:@"reference-%d-%d-%d.mov", width, height, grey]]];
  assert(![[NSFileManager defaultManager] fileExistsAtPath:url.path]);
  fixture(url, true, width, height, grey);
  appleplayback::FrameBudget budget(16 * 1024 * 1024);
  auto decoder = [[STDecodedFrameWindow alloc] initWithURL:url budget:budget sourceRevision:*appleplayback::sourceFileRevision(url)];
  assert([decoder requestStart:0 end:1]); double end = CACurrentMediaTime() + 7;
  while (!decoder.drained && CACurrentMediaTime() < end) pump();
  assert(decoder.drained && !decoder.failed);
  uint8_t result;
  {
    auto frame = [decoder select:0]; assert(frame);
    assert(CVPixelBufferLockBaseAddress(frame->image(), kCVPixelBufferLock_ReadOnly) == kCVReturnSuccess);
    result = *static_cast<const uint8_t *>(CVPixelBufferGetBaseAddressOfPlane(frame->image(), 0));
    CVPixelBufferUnlockBaseAddress(frame->image(), kCVPixelBufferLock_ReadOnly); [decoder close];
  }
  assert(budget.usedBytes() == 0); return result;
}
