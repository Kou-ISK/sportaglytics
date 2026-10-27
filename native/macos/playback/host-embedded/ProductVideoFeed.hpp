#pragma once
#import <Foundation/Foundation.h>
#include "NativePolicy.hpp"
@class EventLog;
@protocol ProductVideoFeed <NSObject>
@property(nonatomic) double launchDeadline;
@property(atomic) BOOL cancelled;
@property(atomic,readonly) BOOL ended;
@property(atomic,readonly) int pid;
-(instancetype)initWithManifest:(NSDictionary*)manifest token:(diagnostic::Request)token single:(BOOL)single owner:(dispatch_queue_t)owner log:(EventLog*)log frame:(void(^)(NSDictionary*))frame done:(void(^)(NSDictionary*))done;
-(void)start;
@end
