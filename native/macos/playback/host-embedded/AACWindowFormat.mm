#import "AACWindow.hpp"
#include "AACCookie.hpp"
namespace localaac {
void validateFormat(CMAudioFormatDescriptionRef format, NSString* layoutHash) {
 const auto* a = CMAudioFormatDescriptionGetStreamBasicDescription(format);
 require(a && a->mSampleRate == 48000 && a->mFormatID == kAudioFormatMPEG4AAC && a->mFramesPerPacket == 1024 && a->mChannelsPerFrame == 2, @"AAC source format");
 size_t length = 0;
 const auto* layout = CMAudioFormatDescriptionGetChannelLayout(format, &length);
 require(layout && length == 12 && [hashBytes(layout, length) isEqualToString:layoutHash], @"AAC original channel layout");
 size_t cookieSize = 0;
 const void* cookie = CMAudioFormatDescriptionGetMagicCookie(format, &cookieSize);
 require(cookie && cookieSize > 0 && cookieSize <= maximumPacketBytes, @"AAC cookie bound");
}
void validateCookie(CMAudioFormatDescriptionRef format,const std::vector<uint8_t>& extra){
 size_t size=0;const auto*cookie=static_cast<const uint8_t*>(CMAudioFormatDescriptionGetMagicCookie(format,&size));
 require(aaccookie::matches(cookie,size,extra.data(),extra.size()),@"AAC cookie/ASC correspondence unsupported");
}
}
