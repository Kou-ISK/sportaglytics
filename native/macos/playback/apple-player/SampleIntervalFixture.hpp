#pragma once
#import <AVFoundation/AVFoundation.h>
#import <ImageIO/ImageIO.h>
#import <QuartzCore/QuartzCore.h>
#include <cassert>
#include <vector>

namespace {
void pump() { [[NSRunLoop mainRunLoop] runUntilDate:[NSDate dateWithTimeIntervalSinceNow:.003]]; }
NSData* jpeg(size_t width, size_t height, uint8_t grey) {
  std::vector<uint8_t> pixels(width * height * 3, grey);
  auto provider = CGDataProviderCreateWithData(nullptr, pixels.data(), pixels.size(), nullptr);
  auto color = CGColorSpaceCreateDeviceRGB();
  auto image = CGImageCreate(width, height, 8, 24, width * 3, color, kCGBitmapByteOrderDefault,
    provider, nullptr, false, kCGRenderingIntentDefault);
  NSMutableData* data = [NSMutableData data];
  auto destination = CGImageDestinationCreateWithData((__bridge CFMutableDataRef)data, CFSTR("public.jpeg"), 1, nullptr);
  assert(image && destination);
  CGImageDestinationAddImage(destination, image, nullptr);
  assert(CGImageDestinationFinalize(destination));
  CFRelease(destination); CGImageRelease(image); CGColorSpaceRelease(color); CGDataProviderRelease(provider);
  return data;
}
void fixture(NSURL* url, bool precise, int width = 16, int height = 16, int constantGrey = -1, bool withAudio = false, int sampleCount = 8, int64_t sessionStartTicks = 0) {
  assert(sampleCount > 0 && sampleCount <= 512);
  NSError* error = nil;
  auto writer = [[AVAssetWriter alloc] initWithURL:url fileType:AVFileTypeQuickTimeMovie error:&error];
  CMVideoFormatDescriptionRef format = nullptr;
  assert(CMVideoFormatDescriptionCreate(nullptr, kCMVideoCodecType_JPEG, width, height, nullptr, &format) == noErr);
  auto input = [[AVAssetWriterInput alloc] initWithMediaType:AVMediaTypeVideo outputSettings:nil sourceFormatHint:format];
  input.mediaTimeScale = precise ? 120000 : 600;
  writer.movieTimeScale = precise ? 120000 : 600;
  assert(writer && [writer canAddInput:input]); [writer addInput:input];
  AVAssetWriterInput *audio = nil; CMAudioFormatDescriptionRef audioFormat = nullptr;
  if (withAudio) {
    AudioStreamBasicDescription pcm{};
    pcm.mSampleRate = 48000; pcm.mFormatID = kAudioFormatLinearPCM;
    pcm.mFormatFlags = kAudioFormatFlagIsSignedInteger | kAudioFormatFlagIsPacked;
    pcm.mBytesPerPacket = 2; pcm.mFramesPerPacket = 1; pcm.mBytesPerFrame = 2;
    pcm.mChannelsPerFrame = 1; pcm.mBitsPerChannel = 16;
    assert(CMAudioFormatDescriptionCreate(nullptr, &pcm, 0, nullptr, 0, nullptr, nullptr, &audioFormat) == noErr);
    audio = [[AVAssetWriterInput alloc] initWithMediaType:AVMediaTypeAudio outputSettings:nil sourceFormatHint:audioFormat];
    assert([writer canAddInput:audio]); [writer addInput:audio];
  }
  assert([writer startWriting]); [writer startSessionAtSourceTime:CMTimeMake(sessionStartTicks, 120000)];
  int64_t pts = 0;
  for (int n = 0; n < sampleCount; ++n) {
    NSData* image = jpeg(width, height, uint8_t(constantGrey >= 0 ? constantGrey : 40 + (n % 8) * 20));
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
  if (audio) {
    CMBlockBufferRef block = nullptr; CMSampleBufferRef sample = nullptr;
    std::vector<uint8_t> silence(12000 * 2, 0);
    assert(CMBlockBufferCreateWithMemoryBlock(nullptr, nullptr, silence.size(), nullptr, nullptr, 0,
      silence.size(), 0, &block) == kCMBlockBufferNoErr);
    assert(CMBlockBufferReplaceDataBytes(silence.data(), block, 0, silence.size()) == kCMBlockBufferNoErr);
    CMSampleTimingInfo timing{CMTimeMake(1, 48000), kCMTimeZero, kCMTimeInvalid}; size_t size = 2;
    assert(CMSampleBufferCreateReady(nullptr, block, audioFormat, 12000, 1, &timing, 1, &size, &sample) == noErr);
    const double deadline = CACurrentMediaTime() + 2;
    while (!audio.readyForMoreMediaData && CACurrentMediaTime() < deadline) pump();
    assert(audio.readyForMoreMediaData && [audio appendSampleBuffer:sample]);
    CFRelease(sample); CFRelease(block); [audio markAsFinished]; CFRelease(audioFormat);
  }
  [input markAsFinished]; __block bool finished = false;
  [writer finishWritingWithCompletionHandler:^{ finished = true; }];
  const double deadline = CACurrentMediaTime() + 4;
  while (!finished && CACurrentMediaTime() < deadline) pump();
  assert(finished && writer.status == AVAssetWriterStatusCompleted); CFRelease(format);
}
}
