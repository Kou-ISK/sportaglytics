#pragma once
#import "NativeSupport.hpp"
#import <AudioToolbox/AudioToolbox.h>
#include "FiniteAACInput.hpp"
namespace localaac {
constexpr size_t maximumPacketBytes = 65536;
constexpr size_t maximumWindowPacketBytes = 1048576;
constexpr size_t maximumTrackPackets = 180;
inline void check(std::atomic<bool>* cancel, double deadline) {
 require(!cancel->load() && !nativeInterrupted.load() && mono() < deadline, @"local PCM cancelled/deadline");
}
inline int64_t samples(CMTime time) {
 require(time.flags == kCMTimeFlags_Valid && time.epoch == 0 && time.timescale > 0 && time.value >= 0 && time.value <= INT64_MAX / 48000, @"AAC exact source time");
 require(time.value * 48000 % time.timescale == 0, @"AAC nonintegral source sample");
 return time.value * 48000 / time.timescale;
}
inline int64_t trim(CMSampleBufferRef buffer, CFStringRef key) {
 CFTypeRef value = CMGetAttachment(buffer, key, nullptr);
 if (!value) return 0;
 require(CFGetTypeID(value) == CFDictionaryGetTypeID(), @"AAC trim type");
 return samples(CMTimeMakeFromDictionary((CFDictionaryRef)value));
}
NSData* decodeWindow(const finiteaac::Track& track, CMAudioFormatDescriptionRef format, int64_t readStart, int64_t start, int64_t end, NSString* layoutHash, std::atomic<bool>* cancel, double deadline);
void validateFormat(CMAudioFormatDescriptionRef format, NSString* layoutHash);
void validateCookie(CMAudioFormatDescriptionRef format,const std::vector<uint8_t>& extra);
}
