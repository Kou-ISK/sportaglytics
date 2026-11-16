#import "SourceSampleIntervals.hpp"
#import <AVFoundation/AVFoundation.h>
#import <ImageIO/ImageIO.h>
#import <QuartzCore/QuartzCore.h>
#include <cassert>
#include <vector>

namespace {
void pump() { [[NSRunLoop mainRunLoop] runUntilDate:[NSDate dateWithTimeIntervalSinceNow:.003]]; }
void drained(STSourceSampleIntervals* index) {
  const double deadline = CACurrentMediaTime() + 4;
  while (!index.drained && CACurrentMediaTime() < deadline) pump();
  assert(index.drained); // never claim a timed-out scan finished
}
NSData* jpeg() {
  std::vector<uint8_t> pixels(16 * 16 * 3, 80);
  auto provider = CGDataProviderCreateWithData(nullptr, pixels.data(), pixels.size(), nullptr);
  auto color = CGColorSpaceCreateDeviceRGB();
  auto image = CGImageCreate(16, 16, 8, 24, 16 * 3, color, kCGBitmapByteOrderDefault,
    provider, nullptr, false, kCGRenderingIntentDefault);
  NSMutableData* data = [NSMutableData data];
  auto destination = CGImageDestinationCreateWithData((__bridge CFMutableDataRef)data, CFSTR("public.jpeg"), 1, nullptr);
  assert(image && destination);
  CGImageDestinationAddImage(destination, image, nullptr);
  assert(CGImageDestinationFinalize(destination));
  CFRelease(destination); CGImageRelease(image); CGColorSpaceRelease(color); CGDataProviderRelease(provider);
  return data;
}
void fixture(NSURL* url, bool precise) {
  NSError* error = nil;
  auto writer = [[AVAssetWriter alloc] initWithURL:url fileType:AVFileTypeQuickTimeMovie error:&error];
  CMVideoFormatDescriptionRef format = nullptr;
  assert(CMVideoFormatDescriptionCreate(nullptr, kCMVideoCodecType_JPEG, 16, 16, nullptr, &format) == noErr);
  auto input = [[AVAssetWriterInput alloc] initWithMediaType:AVMediaTypeVideo outputSettings:nil sourceFormatHint:format];
  input.mediaTimeScale = precise ? 120000 : 600;
  writer.movieTimeScale = precise ? 120000 : 600;
  assert(writer && [writer canAddInput:input]); [writer addInput:input];
  assert([writer startWriting]); [writer startSessionAtSourceTime:kCMTimeZero];
  NSData* image = jpeg(); int64_t pts = 0;
  for (int n = 0; n < 8; ++n) {
    const double deadline = CACurrentMediaTime() + 2;
    while (!input.readyForMoreMediaData && CACurrentMediaTime() < deadline) pump();
    assert(input.readyForMoreMediaData);
    CMBlockBufferRef block = nullptr; CMSampleBufferRef sample = nullptr;
    assert(CMBlockBufferCreateWithMemoryBlock(nullptr, nullptr, image.length, nullptr, nullptr, 0,
      image.length, 0, &block) == kCMBlockBufferNoErr);
    assert(CMBlockBufferReplaceDataBytes(image.bytes, block, 0, image.length) == kCMBlockBufferNoErr);
    // Deliberately VFR: the index must not infer duration from average fps.
    const int64_t duration = n % 2 ? 4004 : 2002;
    CMSampleTimingInfo timing{CMTimeMake(duration, 120000), CMTimeMake(pts, 120000), kCMTimeInvalid};
    size_t size = image.length;
    assert(CMSampleBufferCreateReady(nullptr, block, format, 1, 1, &timing, 1, &size, &sample) == noErr);
    assert([input appendSampleBuffer:sample]); CFRelease(sample); CFRelease(block); pts += duration;
  }
  [input markAsFinished]; __block bool finished = false;
  [writer finishWritingWithCompletionHandler:^{ finished = true; }];
  const double deadline = CACurrentMediaTime() + 4;
  while (!finished && CACurrentMediaTime() < deadline) pump();
  assert(finished && writer.status == AVAssetWriterStatusCompleted); CFRelease(format);
}
}
int main() { @autoreleasepool {
  NSString* directory = [NSTemporaryDirectory() stringByAppendingPathComponent:[@"sportag-sample-index-" stringByAppendingString:NSUUID.UUID.UUIDString]];
  assert([[NSFileManager defaultManager] createDirectoryAtPath:directory withIntermediateDirectories:NO attributes:nil error:nil]);
  auto url = [NSURL fileURLWithPath:[directory stringByAppendingPathComponent:@"vfr.mov"]]; fixture(url, true);
  auto index = [[STSourceSampleIntervals alloc] initWithURL:url];
  assert([index request:2002] && ![index request:6006]); drained(index); assert(!index.failed);
  auto a = [index lookup:2002], b = [index lookup:6006];
  assert(a && a->start == 2002 && a->end == 6006);
  assert(b && b->start == 6006 && b->end == 8008);
  assert(![index request:2002]); // cached timing does not start another disk scan
  assert(![index lookup:2003]); // arbitrary requested clock is not an output PTS
  [index cancel]; assert(![index lookup:2002] && ![index request:2002]);
  auto cancelled = [[STSourceSampleIntervals alloc] initWithURL:url];
  auto other = [[STSourceSampleIntervals alloc] initWithURL:url];
  assert([cancelled request:0] && [other request:6006]); [cancelled cancel]; drained(cancelled); drained(other);
  assert(![cancelled lookup:0] && ![cancelled request:0]);
  auto independent = [other lookup:6006]; assert(!other.failed && independent && independent->end == 8008);
  [other cancel];
  auto missing = [[STSourceSampleIntervals alloc] initWithURL:[NSURL fileURLWithPath:[directory stringByAppendingPathComponent:@"absent.mov"]]];
  assert([missing request:0]); drained(missing); assert(missing.failed && ![missing lookup:0]);
  [missing cancel];
  auto unmatched = [[STSourceSampleIntervals alloc] initWithURL:url];
  assert([unmatched request:2003]); drained(unmatched); assert(unmatched.failed && ![unmatched request:2003]);
  [unmatched cancel];
  // An explicit coarse 600 Hz movie/track clock quantizes this fixture.
  // Index the actual output clock rather than pretending the input PTS survived.
  auto coarseURL = [NSURL fileURLWithPath:[directory stringByAppendingPathComponent:@"coarse-vfr.mov"]]; fixture(coarseURL, false);
  auto coarse = [[STSourceSampleIntervals alloc] initWithURL:coarseURL];
  assert([coarse request:2000]); drained(coarse); assert(!coarse.failed);
  auto measured = [coarse lookup:2000];
  assert(measured && measured->start == 2000 && measured->end == 6000 && ![coarse lookup:2002]);
  [coarse cancel];
  // Only this test's newly created fixture, after writer/index drainage.
  assert([[NSFileManager defaultManager] removeItemAtURL:url error:nil]);
  assert([[NSFileManager defaultManager] removeItemAtURL:coarseURL error:nil]);
  assert([[NSFileManager defaultManager] removeItemAtPath:directory error:nil]);
  puts("SourceSampleIntervals: actual VFR intervals, no invented PTS, cancellation and missing source passed");
} }
