#pragma once
#import <Foundation/Foundation.h>
#import <CoreMedia/CoreMedia.h>
#include "DirectFieldCopy.hpp"
#include <memory>

namespace directframe { struct ImagePool; std::shared_ptr<ImagePool> makeImagePool(); }
// Immutable decoded field; the logical delivery credit owns its lifetime.
// prepareSample is owner-thread-only, nonblocking, and may return null on pool
// pressure. The same candidate/demand must then be retried without consuming it.
@interface DeferredFieldImage:NSObject
-(instancetype)initWithField:(const AVFrame&)field pts:(int64_t)pts duration:(int64_t)duration pool:(std::shared_ptr<directframe::ImagePool>)pool;
-(CMSampleBufferRef)prepareSample;
@property(nonatomic,readonly) BOOL prepared;
@property(nonatomic,readonly) BOOL decodedReady;
@property(nonatomic,readonly) uint64_t retainedBytes;
@end
