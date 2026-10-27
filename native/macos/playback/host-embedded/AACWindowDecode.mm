#import "AACWindow.hpp"
#include <array>
#include "FiniteAACInput.hpp"
namespace localaac {
using finiteaac::Track;
namespace {
struct Input {
 const Track* track;
 std::atomic<bool>* cancel;
 double deadline;
 NSUInteger index = 0;
 std::array<uint8_t, maximumPacketBytes> bytes{};
 AudioStreamPacketDescription description{};
 bool failed = false;
};
OSStatus supply(AudioConverterRef, UInt32* count, AudioBufferList* buffers, AudioStreamPacketDescription** descriptions, void* context) {
 Input& input = *static_cast<Input*>(context);
 @try {
  if (input.cancel->load() || nativeInterrupted.load() || mono() >= input.deadline || !*count) { input.failed = true; *count = 0; return -1; }
  if (input.index == input.track->packets.size()) {
   *count = 0; buffers->mNumberBuffers = 1; buffers->mBuffers[0] = {2, 0, nullptr}; return noErr;
  }
  const auto& packet = input.track->packets[input.index++];
  size_t bytes = packet.bytes.size();
  if (!bytes || bytes > input.bytes.size()) { input.failed = true; *count = 0; return -2; }
  memcpy(input.bytes.data(), packet.bytes.data(), bytes);
  input.description = {0, 1024, static_cast<UInt32>(bytes)};
  buffers->mNumberBuffers = 1; buffers->mBuffers[0] = {2, static_cast<UInt32>(bytes), input.bytes.data()};
  if (descriptions) *descriptions = &input.description;
  *count = 1; return noErr;
 } @catch (NSException*) { input.failed = true; *count = 0; return -3; }
}
}
NSData* decodeWindow(const Track& track, CMAudioFormatDescriptionRef format, int64_t readStart, int64_t start, int64_t end, NSString* layoutHash, std::atomic<bool>* cancel, double deadline) {
 check(cancel, deadline);
 require(readStart >= 0 && start >= readStart && start - readStart <= 48000 && end > start && end - start <= 120000, @"AAC finite decoded range");
 require(track.packets.size() > 0 && track.packets.size() <= maximumTrackPackets, @"AAC decode packet count");
 validateFormat(format, layoutHash);
 const auto* source = CMAudioFormatDescriptionGetStreamBasicDescription(format);
 AudioStreamBasicDescription output{48000, kAudioFormatLinearPCM, 9, 8, 1, 8, 2, 32, 0};
 AudioConverterRef converter = nullptr;
 OSStatus status = AudioConverterNew(source, &output, &converter);
 require(status == noErr && converter, @"AAC converter create");
 @try {
  size_t cookieSize = 0, layoutSize = 0;
  const void* cookie = CMAudioFormatDescriptionGetMagicCookie(format, &cookieSize);
  const auto* layout = CMAudioFormatDescriptionGetChannelLayout(format, &layoutSize);
  require(AudioConverterSetProperty(converter, kAudioConverterDecompressionMagicCookie, static_cast<UInt32>(cookieSize), cookie) == noErr, @"AAC converter cookie");
  require(AudioConverterSetProperty(converter, kAudioConverterInputChannelLayout, static_cast<UInt32>(layoutSize), layout) == noErr && AudioConverterSetProperty(converter, kAudioConverterOutputChannelLayout, static_cast<UInt32>(layoutSize), layout) == noErr, @"AAC converter channel layout");
  AudioStreamBasicDescription actualInput{}, actualOutput{};
  UInt32 inputSize = sizeof(actualInput), outputSize = sizeof(actualOutput);
  require(AudioConverterGetProperty(converter, kAudioConverterCurrentInputStreamDescription, &inputSize, &actualInput) == noErr && inputSize == sizeof(actualInput) && AudioConverterGetProperty(converter, kAudioConverterCurrentOutputStreamDescription, &outputSize, &actualOutput) == noErr && outputSize == sizeof(actualOutput), @"AAC converter format query");
  require(actualInput.mSampleRate == source->mSampleRate && actualInput.mFormatID == source->mFormatID && actualInput.mFormatFlags == source->mFormatFlags && actualInput.mBytesPerPacket == source->mBytesPerPacket && actualInput.mFramesPerPacket == source->mFramesPerPacket && actualInput.mBytesPerFrame == source->mBytesPerFrame && actualInput.mChannelsPerFrame == source->mChannelsPerFrame && actualInput.mBitsPerChannel == source->mBitsPerChannel, @"AAC converter input changed");
  require(actualOutput.mSampleRate == output.mSampleRate && actualOutput.mFormatID == output.mFormatID && actualOutput.mFormatFlags == output.mFormatFlags && actualOutput.mBytesPerPacket == output.mBytesPerPacket && actualOutput.mFramesPerPacket == output.mFramesPerPacket && actualOutput.mBytesPerFrame == output.mBytesPerFrame && actualOutput.mChannelsPerFrame == output.mChannelsPerFrame && actualOutput.mBitsPerChannel == output.mBitsPerChannel, @"AAC converter output changed");
  // Container trim/output PTS remain authoritative. Do not assume a fixed priming offset.
  AudioConverterPrimeInfo prime{}; UInt32 primeSize = sizeof(prime);
  require(AudioConverterGetProperty(converter, kAudioConverterPrimeInfo, &primeSize, &prime) == noErr && primeSize == sizeof(prime) && prime.leadingFrames == 0 && prime.trailingFrames == 0, @"AAC unsupported converter priming");
  Input input{&track, cancel, deadline};
  NSMutableData* data = [NSMutableData new];
  NSUInteger index = 0;
  int64_t expected = readStart;
  while (true) {
   check(cancel, deadline);
   require(index <= track.packets.size(), @"AAC converter output bound");
   float pcm[2048]; UInt32 frames = 1024;
   AudioBufferList buffers{1, {{2, sizeof(pcm), pcm}}};
   status = AudioConverterFillComplexBuffer(converter, supply, &input, &frames, &buffers, nullptr);
   check(cancel, deadline);
   require(status == noErr && !input.failed && frames <= 1024 && buffers.mNumberBuffers == 1 && buffers.mBuffers[0].mDataByteSize == frames * 8, @"AAC converter output");
   if (!frames) break;
   require(index < track.packets.size() && frames == 1024, @"AAC exact decoded packet length");
   for (size_t n = 0; n < frames * 2; n++) require(std::isfinite(pcm[n]), @"PCM nonfinite");
   const auto& packet = track.packets[index++];
   require(packet.pts >= -4096 && packet.pts <= INT64_MAX - 1024 && packet.duration > 0 && packet.duration <= 1024, @"demux packet range");
   int64_t head = MAX((int64_t)0, MIN((int64_t)1024, readStart - packet.pts));
   int64_t tail = MIN(1024 - head, MAX((int64_t)0, packet.pts + 1024 - end));
   int64_t pts = MAX(readStart, packet.pts), duration = 1024 - head - tail;
   require(pts == expected && head <= frames && tail <= frames - head && duration == frames - head - tail && duration <= end - expected, @"AAC output trim continuity");
   int64_t keepStart = MAX(start, pts), keepEnd = MIN(end, pts + duration);
   if (keepEnd > keepStart) {
    size_t bytes = static_cast<size_t>(keepEnd - keepStart) * 8;
    require(data.length + bytes <= 960000, @"PCM bounded retained data");
    [data appendBytes:reinterpret_cast<const char*>(pcm) + (head + keepStart - pts) * 8 length:bytes];
   }
   expected += duration;
  }
  require(input.index == track.packets.size() && index == track.packets.size() && expected == end && data.length == (end - start) * 8, @"AAC complete PCM window");
  return data;
 } @finally { require(AudioConverterDispose(converter) == noErr, @"AAC converter disposal"); }
}
}
