#pragma once
#import "NativeSupport.hpp"
@interface PCMWindowSupply:NSObject
-(instancetype)initWithManifest:(NSDictionary*)manifest log:(EventLog*)log ready:(void(^)(NSString*))ready;
-(void)selectSample:(int64_t)sample;
-(BOOL)covers:(int64_t)sample;
-(BOOL)coversTarget:(int64_t)ticks reserve:(int64_t)reserve;
@property(nonatomic,readonly) int64_t sourceStart;
@property(nonatomic,readonly) int64_t sourceEnd;
-(void)prefetchAt:(int64_t)sample playing:(BOOL)playing;
-(id)bufferForTrack:(unsigned)track sample:(int64_t)sample;
-(void)close;
@property(nonatomic,readonly) BOOL drained;
@end
