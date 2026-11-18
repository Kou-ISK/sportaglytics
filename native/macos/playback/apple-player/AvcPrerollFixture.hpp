#pragma once
#import <AVFoundation/AVFoundation.h>
#import <QuartzCore/QuartzCore.h>
#include <cstdio>

// Original test recipe: sixty distinct grey frames, 64x64 H.264, two seconds.
// Encoding is bounded and failure is reported; no encoder fallback or download.
inline int avcPrerollFixture(NSURL *url) {
  NSError *error = nil;
  auto writer = [[AVAssetWriter alloc] initWithURL:url fileType:AVFileTypeQuickTimeMovie error:&error];
  NSDictionary *compression = @{
    AVVideoAverageBitRateKey:@200000,
    AVVideoProfileLevelKey:AVVideoProfileLevelH264MainAutoLevel,
    AVVideoAllowFrameReorderingKey:@YES,
    AVVideoMaxKeyFrameIntervalKey:@60,
    AVVideoExpectedSourceFrameRateKey:@30
  };
  auto input = [[AVAssetWriterInput alloc] initWithMediaType:AVMediaTypeVideo outputSettings:@{
    AVVideoCodecKey:AVVideoCodecTypeH264, AVVideoWidthKey:@64, AVVideoHeightKey:@64,
    AVVideoCompressionPropertiesKey:compression
  }];
  auto adapter = [[AVAssetWriterInputPixelBufferAdaptor alloc] initWithAssetWriterInput:input
    sourcePixelBufferAttributes:@{
      (id)kCVPixelBufferPixelFormatTypeKey:@(kCVPixelFormatType_32BGRA),
      (id)kCVPixelBufferWidthKey:@64, (id)kCVPixelBufferHeightKey:@64,
      (id)kCVPixelBufferIOSurfacePropertiesKey:@{}
    }];
  if (!writer || ![writer canAddInput:input]) return 3;
  [writer addInput:input];
  if (![writer startWriting]) {
    fprintf(stderr, "AVC fixture start: %s\n", writer.error.description.UTF8String); return 4;
  }
  [writer startSessionAtSourceTime:kCMTimeZero];
  const double deadline = CACurrentMediaTime() + 10;
  for (int n = 0; n < 60; ++n) {
    while (!input.readyForMoreMediaData && writer.status == AVAssetWriterStatusWriting && CACurrentMediaTime() < deadline)
      [[NSRunLoop mainRunLoop] runUntilDate:[NSDate dateWithTimeIntervalSinceNow:.003]];
    if (!input.readyForMoreMediaData || CACurrentMediaTime() >= deadline) {
      fprintf(stderr, "AVC fixture ready: %s\n", writer.error.description.UTF8String); return 5;
    }
    CVPixelBufferRef image = nullptr;
    if (CVPixelBufferPoolCreatePixelBuffer(nullptr, adapter.pixelBufferPool, &image)) return 6;
    if (CVPixelBufferLockBaseAddress(image, 0) != kCVReturnSuccess) { CVPixelBufferRelease(image); return 6; }
    auto *bytes = static_cast<uint8_t *>(CVPixelBufferGetBaseAddress(image));
    for (int y = 0; y < 64; ++y) for (int x = 0; x < 64; ++x) {
      auto *pixel = bytes + y * CVPixelBufferGetBytesPerRow(image) + x * 4;
      pixel[0] = pixel[1] = pixel[2] = uint8_t(40 + (n * 3) % 180); pixel[3] = 255;
    }
    CVPixelBufferUnlockBaseAddress(image, 0);
    const bool appended = [adapter appendPixelBuffer:image withPresentationTime:CMTimeMake(n, 30)];
    CVPixelBufferRelease(image);
    if (!appended) {
      fprintf(stderr, "AVC fixture append: %s\n", writer.error.description.UTF8String); return 7;
    }
  }
  [input markAsFinished];
  __block bool done = false;
  [writer finishWritingWithCompletionHandler:^{ dispatch_async(dispatch_get_main_queue(), ^{ done = true; }); }];
  const double finishDeadline = CACurrentMediaTime() + 5;
  while (!done && CACurrentMediaTime() < finishDeadline)
    [[NSRunLoop mainRunLoop] runUntilDate:[NSDate dateWithTimeIntervalSinceNow:.003]];
  if (!done || writer.status != AVAssetWriterStatusCompleted) {
    fprintf(stderr, "AVC fixture finish: %s\n", writer.error.description.UTF8String); return 8;
  }
  return 0;
}
