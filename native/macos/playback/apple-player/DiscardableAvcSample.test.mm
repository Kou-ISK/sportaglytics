#import "AvcPrerollFixture.hpp"
#import "DecodedFrameWindow.hpp"
#import "DiscardableAvcSample.hpp"
#include <cassert>
#include <cstring>
#include <cstdio>
void pumpAvc() { [[NSRunLoop mainRunLoop] runUntilDate:[NSDate dateWithTimeIntervalSinceNow:.003]]; }
void waitAvc(STDecodedFrameWindow *decoder) {
  const double deadline = CACurrentMediaTime() + 7;
  while (!decoder.drained && CACurrentMediaTime() < deadline) pumpAvc();
  assert(decoder.drained && !decoder.failed);
}
void identical(CVPixelBufferRef a, CVPixelBufferRef b) {
  assert(CVPixelBufferGetPixelFormatType(a) == CVPixelBufferGetPixelFormatType(b));
  assert(CVPixelBufferGetPlaneCount(a) == 2 && CVPixelBufferGetPlaneCount(b) == 2);
  assert(CVPixelBufferLockBaseAddress(a, kCVPixelBufferLock_ReadOnly) == kCVReturnSuccess);
  assert(CVPixelBufferLockBaseAddress(b, kCVPixelBufferLock_ReadOnly) == kCVReturnSuccess);
  for (size_t plane = 0; plane < 2; ++plane) {
    const size_t width = CVPixelBufferGetWidthOfPlane(a, plane), height = CVPixelBufferGetHeightOfPlane(a, plane);
    assert(width == CVPixelBufferGetWidthOfPlane(b, plane) && height == CVPixelBufferGetHeightOfPlane(b, plane));
    const auto *left = static_cast<const uint8_t *>(CVPixelBufferGetBaseAddressOfPlane(a, plane));
    const auto *right = static_cast<const uint8_t *>(CVPixelBufferGetBaseAddressOfPlane(b, plane));
    for (size_t row = 0; row < height; ++row)
      assert(!std::memcmp(left + row * CVPixelBufferGetBytesPerRowOfPlane(a, plane),
        right + row * CVPixelBufferGetBytesPerRowOfPlane(b, plane), width * (plane ? 2 : 1)));
  }
  CVPixelBufferUnlockBaseAddress(b, kCVPixelBufferLock_ReadOnly);
  CVPixelBufferUnlockBaseAddress(a, kCVPixelBufferLock_ReadOnly);
}
void sampleAdapterBoundaries(NSURL *url) {
  auto asset = [AVURLAsset URLAssetWithURL:url options:nil];
  __block NSArray<AVAssetTrack *> *tracks = nil;
  [asset loadTracksWithMediaType:AVMediaTypeVideo completionHandler:^(NSArray<AVAssetTrack *> *loaded, NSError *error) {
    assert(!error); dispatch_async(dispatch_get_main_queue(), ^{ tracks = loaded; });
  }];
  const double deadline = CACurrentMediaTime() + 4;
  while (!tracks && CACurrentMediaTime() < deadline) pumpAvc();
  assert(tracks.count == 1);
  NSError *error = nil;
  auto reader = [[AVAssetReader alloc] initWithAsset:asset error:&error];
  auto output = [[AVAssetReaderTrackOutput alloc] initWithTrack:tracks.firstObject outputSettings:nil];
  assert(reader && !error && [reader canAddOutput:output]); [reader addOutput:output];
  assert([reader startReading]);
  auto raw = [output copyNextSampleBuffer];
  size_t markers = 0;
  while (raw && CMSampleBufferGetNumSamples(raw) == 0) {
    assert(++markers <= 8 && !appleplayback::discardableAvcSample(raw));
    CFRelease(raw); raw = [output copyNextSampleBuffer];
  }
  assert(raw);
  auto format = CMSampleBufferGetFormatDescription(raw); assert(format);
  int prefix = 0;
  assert(CMVideoFormatDescriptionGetH264ParameterSetAtIndex(format, 0, nullptr, nullptr, nullptr, &prefix) == noErr);
  assert(prefix == 4);
  // Only adapter framing is under test here; these bytes are not decoded.
  uint8_t bytes[] = {0, 0, 0, 2, 1, 0xb8};
  for (bool fragmented : {false, true}) {
    CMBlockBufferRef block = nullptr;
    assert(CMBlockBufferCreateEmpty(nullptr, 2, 0, &block) == noErr);
    const size_t split = fragmented ? 3 : sizeof(bytes);
    assert(CMBlockBufferAppendMemoryBlock(block, nullptr, split, nullptr, nullptr, 0, split, 0) == noErr);
    if (fragmented)
      assert(CMBlockBufferAppendMemoryBlock(block, nullptr, sizeof(bytes) - split, nullptr, nullptr, 0, sizeof(bytes) - split, 0) == noErr);
    assert(CMBlockBufferReplaceDataBytes(bytes, block, 0, sizeof(bytes)) == noErr);
    CMSampleBufferRef sample = nullptr;
    const size_t size = sizeof(bytes);
    CMSampleTimingInfo timing{CMTimeMake(1, 30), kCMTimeZero, kCMTimeInvalid};
    assert(CMSampleBufferCreateReady(nullptr, block, format, 1, 1, &timing, 1, &size, &sample) == noErr);
    assert(appleplayback::discardableAvcSample(sample));
    CMSetAttachment(sample, kCMSampleBufferAttachmentKey_ResetDecoderBeforeDecoding, kCFBooleanTrue, kCMAttachmentMode_ShouldNotPropagate);
    assert(!appleplayback::discardableAvcSample(sample));
    CMRemoveAttachment(sample, kCMSampleBufferAttachmentKey_ResetDecoderBeforeDecoding);
    CMSetAttachment(sample, kCMSampleBufferAttachmentKey_DrainAfterDecoding, kCFBooleanTrue, kCMAttachmentMode_ShouldNotPropagate);
    assert(!appleplayback::discardableAvcSample(sample));
    CFRelease(sample); CFRelease(block);
  }
  // Real generated compressed samples: count actual positive classifications,
  // without assuming every encoder/OS emits B pictures when reordering is allowed.
  size_t samples = 0, discardable = 0;
  do {
    if (CMSampleBufferGetNumSamples(raw) == 0) {
      assert(++markers <= 8 && !appleplayback::discardableAvcSample(raw));
      CFRelease(raw); raw = [output copyNextSampleBuffer]; continue;
    }
    assert(++samples <= 64 && CACurrentMediaTime() < deadline);
    if (appleplayback::discardableAvcSample(raw)) ++discardable;
    CFRelease(raw); raw = [output copyNextSampleBuffer];
  } while (raw);
  assert(reader.status == AVAssetReaderStatusCompleted && samples == 60);
  printf("AVC adapter checked %zu actual packets, %zu non-reference picture packets\n", samples, discardable);
  [reader cancelReading];
}
int main() { @autoreleasepool {
  assert(!appleplayback::discardableAvcSample(nullptr));
  auto directory = [NSTemporaryDirectory() stringByAppendingPathComponent:
    [@"sportag-avc-preroll-" stringByAppendingString:NSUUID.UUID.UUIDString]];
  assert([[NSFileManager defaultManager] createDirectoryAtPath:directory withIntermediateDirectories:NO attributes:nil error:nil]);
  auto url = [NSURL fileURLWithPath:[directory stringByAppendingPathComponent:@"control.mov"]];
  assert(avcPrerollFixture(url) == 0);
  sampleAdapterBoundaries(url);
  appleplayback::FrameBudget budget(16 * 1024 * 1024);
  const auto revision = *appleplayback::sourceFileRevision(url);
  auto full = [[STDecodedFrameWindow alloc] initWithURL:url budget:budget sourceRevision:revision];
  // All first-second pictures are wanted: this is the ordinary full-decode reference.
  assert([full requestStart:0 end:120000]); waitAvc(full);
  size_t compared = 0;
  for (const auto range : {std::pair<uint64_t, uint64_t>{60000, 90000}, {28000, 56000}, {112000, 119999}}) {
    auto partial = [[STDecodedFrameWindow alloc] initWithURL:url budget:budget sourceRevision:revision];
    assert([partial requestStart:range.first end:range.second]); waitAvc(partial);
    for (uint64_t tick = range.first; tick < range.second; tick += 997) {
      auto reference = [full select:tick], actual = [partial select:tick];
      assert(reference && actual && reference->pts() == actual->pts() && reference->end() == actual->end());
      identical(reference->image(), actual->image()); ++compared;
    }
    [partial close]; assert(partial.drained);
  }
  [full close]; assert(full.drained && budget.usedBytes() == 0);
  assert([[NSFileManager defaultManager] removeItemAtPath:directory error:nil]);
  printf("AVC actual full-decode vs partial-preroll: %zu image/time comparisons, physical drain and zero charge passed\n", compared);
} }
