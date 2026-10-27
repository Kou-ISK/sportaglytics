#pragma once
#import <Foundation/Foundation.h>
#import <CoreMedia/CoreMedia.h>
#import "../direct-frame-handoff/DeferredFieldImage.hpp"
#include "NativePolicy.hpp"
namespace diagnostic {
inline bool stoppedForwardSeek(bool prepared,CMTime stopped,Float64 rate,CMTime requested){return prepared&&rate==0&&CMTIME_IS_NUMERIC(stopped)&&CMTIME_IS_NUMERIC(requested)&&stopped.timescale>0&&requested.timescale>0&&CMTimeCompare(requested,stopped)>0;}
// A paused playback clock alone does not prove that the old seek image matches.
// Keep the acknowledged image only at its exact original source anchor.
inline bool repeatsStoppedImage(bool eligible,bool acknowledged,int64_t activeField,CMTime anchor,CMTime stopped,Float64 rate,CMTime requested,int64_t requestedField){
 return eligible&&acknowledged&&activeField==requestedField&&rate==0&&
 CMTIME_IS_NUMERIC(anchor)&&CMTIME_IS_NUMERIC(stopped)&&CMTIME_IS_NUMERIC(requested)&&
 anchor.timescale>0&&stopped.timescale>0&&requested.timescale>0&&
 anchor.epoch==0&&stopped.epoch==0&&requested.epoch==0&&
 CMTimeCompare(anchor,requested)==0&&CMTimeCompare(stopped,requested)==0;
}
inline std::vector<BufferedFieldStamp> bufferedFieldStamps(NSArray<NSDictionary*>*frames){
 std::vector<BufferedFieldStamp> result;if(frames.count>32)return result;result.reserve(frames.count);
 for(NSDictionary*f in frames){DeferredFieldImage*image=f[@"image"];BOOL ready=f[@"sample"]!=nil||([image isKindOfClass:DeferredFieldImage.class]&&image.decodedReady);result.push_back({[f[@"session"]unsignedLongLongValue],[f[@"generation"]unsignedLongLongValue],[f[@"pts"]longLongValue],static_cast<bool>(ready),static_cast<bool>([f[@"sourceTimingValidated"]boolValue])});}return result;
}
// Retain the exact immutable image and same delivery lease. No new allocation
// budget and no pixel/PTS change; transferred GPU surfaces are not passed here.
inline NSDictionary* rebindBufferedField(NSDictionary*field,const Request&presentation){
 NSMutableDictionary*result=[field mutableCopy];result[@"session"]=@(presentation.session);result[@"generation"]=@(presentation.generation);return result;
}
}
