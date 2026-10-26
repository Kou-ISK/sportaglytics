#pragma once
#import <AppKit/AppKit.h>
#import <AVFoundation/AVFoundation.h>
#import <CoreVideo/CoreVideo.h>
#import <IOSurface/IOSurface.h>
#import <CommonCrypto/CommonDigest.h>
#include <chrono>
#include <mutex>
#include <atomic>
#include <vector>
#include <map>
#include <set>
#include <string>
#include <poll.h>
#include <fcntl.h>
#include <unistd.h>
#include "NativePolicy.hpp"
#import "ProductVideoFeed.hpp"
extern std::atomic<bool> nativeInterrupted;
inline double mono(){return std::chrono::duration<double>(std::chrono::steady_clock::now().time_since_epoch()).count();}
inline NSString* hashBytes(const void*b,size_t n){unsigned char h[32];CC_SHA256(b,(CC_LONG)n,h);NSMutableString*s=[NSMutableString string];for(auto x:h)[s appendFormat:@"%02x",x];return s;}
inline void require(bool ok,NSString*message){if(!ok)@throw [NSException exceptionWithName:@"DiagnosticFailure" reason:message userInfo:nil];}
inline NSDictionary* timeJSON(CMTime t){return @{@"value":@(t.value),@"scale":@(t.timescale),@"flags":@(t.flags),@"epoch":@(t.epoch)};}
inline bool equalTime(CMTime a,int64_t ticks,int32_t scale){return CMTIME_IS_NUMERIC(a)&&CMTimeCompare(a,CMTimeMake(ticks,scale))==0;}
@interface EventLog:NSObject
-(instancetype)initWithRolling:(BOOL)rolling;
-(void)add:(NSString*)event values:(NSDictionary*)values;
-(NSArray*)snapshot;
@property(nonatomic,readonly) BOOL overflowed;
@property(nonatomic,readonly) uint64_t count;
@end
@interface VideoFeed:NSObject<ProductVideoFeed>
@property(nonatomic) double launchDeadline;
@property(atomic) BOOL cancelled;
@property(atomic,readonly) BOOL ended;
@property(atomic,readonly) int pid;
-(instancetype)initWithManifest:(NSDictionary*)manifest token:(diagnostic::Request)token single:(BOOL)single owner:(dispatch_queue_t)owner log:(EventLog*)log frame:(void(^)(NSDictionary*))frame done:(void(^)(NSDictionary*))done;
-(void)start;
@end
@interface AudioPrefix:NSObject
@property(nonatomic) int64_t startSample;
@property(nonatomic) int64_t endSample;
@property(nonatomic,strong) NSArray<NSArray*>*tracks;
@property(nonatomic,strong) NSArray<NSArray*>*markers;
@property(nonatomic,strong) NSArray*proof;
+(AudioPrefix*)load:(NSDictionary*)manifest window:(NSDictionary*)window cancel:(std::atomic<bool>*)cancel log:(EventLog*)log;
@end
NSString* pixelHash(CVPixelBufferRef p);
