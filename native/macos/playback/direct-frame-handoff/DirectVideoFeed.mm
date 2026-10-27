#import "DirectVideoFeed.hpp"
#import "../host-embedded/NativeSupport.hpp"
#include "DirectFieldCopy.hpp"
#include "PoolWait.hpp"
#import "FrameDeliveryLease.hpp"
#import "DeferredFieldImage.hpp"
#include <stdexcept>
#include <limits>
namespace {
struct Pool {CVPixelBufferPoolRef value=nullptr;~Pool(){if(value)CVPixelBufferPoolRelease(value);}};
struct Pixel {CVPixelBufferRef value=nullptr;~Pixel(){if(value)CVPixelBufferRelease(value);}};
struct Format {CMVideoFormatDescriptionRef value=nullptr;~Format(){if(value)CFRelease(value);}};
struct Sample {CMSampleBufferRef value=nullptr;~Sample(){if(value)CFRelease(value);}};
void check(bool ok,const char*why){if(!ok)throw std::runtime_error(why);}
}
@implementation DirectVideoFeed {
 NSDictionary*m_;diagnostic::Request token_;BOOL single_;dispatch_queue_t owner_;EventLog*log_;
 void(^frame_)(NSDictionary*);void(^done_)(NSDictionary*);std::atomic<bool>cancel_,ended_;
 std::shared_ptr<directframe::FrameDeliveryBudget> delivery_;
}
-(instancetype)initWithManifest:(NSDictionary*)m token:(diagnostic::Request)t single:(BOOL)s owner:(dispatch_queue_t)o log:(EventLog*)l frame:(void(^)(NSDictionary*))f done:(void(^)(NSDictionary*))d {
 if((self=[super init])){m_=m;token_=t;single_=s;owner_=o;log_=l;frame_=[f copy];done_=[d copy];cancel_=false;ended_=false;delivery_=std::make_shared<directframe::FrameDeliveryBudget>(diagnostic::MaxSurfaces);}return self;
}
-(BOOL)cancelled{return cancel_.load();}-(void)setCancelled:(BOOL)value{cancel_=value;delivery_->wake();}
-(BOOL)ended{return ended_.load();}-(int)pid{return 0;} // There is no child producer process.
-(void)start{
 dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED,0),^{@autoreleasepool{
  NSDictionary*result=[self runWorker]; // Decoder/filter/pool ownership has left scope.
  NSMutableDictionary*report=[result mutableCopy];report[@"workerReturned"]=@YES;
  ended_=true;[log_ add:@"producer-finished" values:report];dispatch_async(owner_,^{done_(report);});
 }});
}
-(NSDictionary*)runWorker{
 const BOOL streaming=[m_[@"rollingPCM"]boolValue];
 double started=mono(),deadline=streaming?std::numeric_limits<double>::infinity():started+30;NSUInteger poolWaits=0;size_t surfaceBytes=0,stageCount=0;BOOL surfaceHistoryTruncated=NO;
 std::map<uint32_t,size_t>surfaces;NSMutableArray*stages=[NSMutableArray array];directframe::Result result;
 [log_ add:@"producer-run-start" values:@{@"generation":@(token_.generation),@"monotonic":@(started),@"executionKind":@"in-process-avframe"}];
 try{
  @try{
   check(self.launchDeadline>0&&mono()<self.launchDeadline,"late direct worker start");
   if(cancel_.load()||nativeInterrupted.load())throw directframe::Cancelled{};
   const BOOL deferred=[m_[@"deferredImages"]boolValue];
   auto deferredPool=deferred?directframe::makeImagePool():nullptr;
   check(!deferred||[m_[@"fieldReferences"] count]==0,"reference diagnostic requires eager images");
   Pool pool;
   NSDictionary*attrs=@{(id)kCVPixelBufferWidthKey:@1920,(id)kCVPixelBufferHeightKey:@1080,(id)kCVPixelBufferPixelFormatTypeKey:@(kCVPixelFormatType_420YpCbCr8BiPlanarVideoRange),(id)kCVPixelBufferIOSurfacePropertiesKey:@{}};
   if(!deferred)check(CVPixelBufferPoolCreate(kCFAllocatorDefault,(__bridge CFDictionaryRef)@{(id)kCVPixelBufferPoolMinimumBufferCountKey:@32,(id)kCVPixelBufferPoolMaximumBufferAgeKey:@0},(__bridge CFDictionaryRef)attrs,&pool.value)==0&&pool.value,"direct pool create");
   check(mono()<self.launchDeadline,"late direct source open");
   const int64_t end=single_?token_.target+diagnostic::Step:[m_[@"videoEnd"]longLongValue];
   directframe::Options options{[m_[@"source"]UTF8String],token_.target,end,streaming?started+5:deadline,[&]{return cancel_.load()||nativeInterrupted.load();}};
   if(streaming)options.timeline.emplace([m_[@"fieldFirst"]longLongValue],[m_[@"videoEnd"]longLongValue]);options.streaming=streaming;options.profileOperations=[m_[@"profileOperations"]boolValue];options.recurrenceGeneration=token_.generation;
   result=directframe::read(options,[&](const AVFrame&field,int64_t pts,int64_t duration){@autoreleasepool{
    try{
     @try{
      recurrence::note(0,20,token_.generation,0,pts);
      double fieldAt=mono(),deliveryWaitAt=mono();recurrence::note(0,21,token_.generation,0,pts);
      std::shared_ptr<directframe::FrameDeliveryBudget::Permit> permit;
      try{permit=delivery_->acquire(options.cancelled,deadline,[]{return mono();},token_.generation,pts);}catch(...){recurrence::note(0,23,token_.generation,0,pts);throw;}
      recurrence::note(0,22,token_.generation,0,pts);
      double deliveryWait=mono()-deliveryWaitAt;
      FrameDeliveryLease*lease=[[FrameDeliveryLease alloc]initWithPermit:std::move(permit)];
      if(deferred){
       DeferredFieldImage*image=[[DeferredFieldImage alloc]initWithField:field pts:pts duration:duration pool:deferredPool];
       NSDictionary*output=@{@"image":image,@"deliveryLease":lease,@"generation":@(token_.generation),@"session":@(token_.session),@"pts":@(pts),@"index":@((pts-[m_[@"fieldFirst"]longLongValue])/diagnostic::Step),@"sha":[NSNull null],@"sourceTimingValidated":@YES,@"referenceCompared":@NO,@"created":@(mono()),@"decodedBytes":@(image.retainedBytes),@"surfaceID":@0,@"surfaceBytes":@0};
       ++stageCount;recurrence::note(0,24,token_.generation,0,pts);dispatch_async(owner_,^{frame_(output);});return;
      }
      Pixel pixel;double poolWait=0;NSUInteger waits=0;
      directframe::acquireSlot([&]{
       CVReturn status=CVPixelBufferPoolCreatePixelBufferWithAuxAttributes(kCFAllocatorDefault,pool.value,(__bridge CFDictionaryRef)@{(id)kCVPixelBufferPoolAllocationThresholdKey:@32},&pixel.value);
       if(status==kCVReturnWouldExceedAllocationThreshold){check(!pixel.value,"pressure returned owned pixel");return directframe::Slot::pressure;}
       check(status==0&&pixel.value,"direct pixel allocation");return directframe::Slot::acquired;
      },options.cancelled,deadline,[]{return mono();},[&]{++poolWaits;++waits;double a=mono();[NSThread sleepForTimeInterval:.002];poolWait+=mono()-a;});
      IOSurfaceRef io=CVPixelBufferGetIOSurface(pixel.value);check(io,"direct IOSurface absent");
      auto found=surfaces.find(IOSurfaceGetID(io));
      if(found==surfaces.end()){if(surfaces.size()<128){surfaces.emplace(IOSurfaceGetID(io),IOSurfaceGetAllocSize(io));surfaceBytes+=IOSurfaceGetAllocSize(io);}else surfaceHistoryTruncated=YES;}
      // Allocation threshold limits simultaneous buffers. Historical IDs may
      // exceed that after legitimate reallocation; they are observations only.
      check(IOSurfaceGetAllocSize(io)<=diagnostic::MaxSurfaceBytes/diagnostic::MaxSurfaces,"direct surface allocation bound");
      double copyAt=mono();directframe::copyToNV12(field,pixel.value);double copyWall=mono()-copyAt;
      CVBufferSetAttachments(pixel.value,(__bridge CFDictionaryRef)@{(id)kCVImageBufferColorPrimariesKey:(id)kCVImageBufferColorPrimaries_ITU_R_709_2,(id)kCVImageBufferTransferFunctionKey:(id)kCVImageBufferTransferFunction_ITU_R_709_2,(id)kCVImageBufferYCbCrMatrixKey:(id)kCVImageBufferYCbCrMatrix_ITU_R_709_2,(id)kCVImageBufferFieldCountKey:@1,(id)kCVImageBufferPixelAspectRatioKey:@{(id)kCVImageBufferPixelAspectRatioHorizontalSpacingKey:@1,(id)kCVImageBufferPixelAspectRatioVerticalSpacingKey:@1}},kCVAttachmentMode_ShouldPropagate);
      NSString*reference=m_[@"fieldReferences"][[NSString stringWithFormat:@"%lld",(long long)pts]],*sha=nil;
      if(reference){sha=pixelHash(pixel.value);check([sha isEqualToString:reference],"direct saved field reference mismatch");}
      Format format;Sample sample;check(CMVideoFormatDescriptionCreateForImageBuffer(kCFAllocatorDefault,pixel.value,&format.value)==0&&format.value,"direct sample format");
      CMSampleTimingInfo timing={CMTimeMake(duration,120000),CMTimeMake(pts,120000),kCMTimeInvalid};
      check(CMSampleBufferCreateReadyWithImageBuffer(kCFAllocatorDefault,pixel.value,format.value,&timing,&sample.value)==0&&sample.value,"direct timed sample");
      if(options.cancelled())throw directframe::Cancelled{};
      check(mono()<deadline,"direct callback deadline");
      NSDictionary*output=@{@"sample":(__bridge id)sample.value,@"deliveryLease":lease,@"generation":@(token_.generation),@"session":@(token_.session),@"pts":@(pts),@"index":@((pts-[m_[@"fieldFirst"]longLongValue])/diagnostic::Step),@"sha":sha?:[NSNull null],@"sourceTimingValidated":@YES,@"referenceCompared":@(reference!=nil),@"created":@(mono()),@"surfaceID":@(IOSurfaceGetID(io)),@"surfaceBytes":@(IOSurfaceGetAllocSize(io))};
      if(!streaming||[m_[@"tracePlayback"]boolValue]){NSDictionary*stage=@{@"pts":@(pts),@"fieldReadyAt":@(fieldAt-started),@"at":@(mono()-started),@"copyWall":@(copyWall),@"poolWaitWall":@(poolWait),@"poolWaits":@(waits),@"deliveryWaitWall":@(deliveryWait),@"referenceCompared":@(reference!=nil)};
      if(stages.count<1200)[stages addObject:stage];else stages[stageCount%1200]=stage;}++stageCount;
      recurrence::note(0,24,token_.generation,0,pts);dispatch_async(owner_,^{frame_(output);});
     }@catch(NSException*e){throw std::runtime_error(e.reason.UTF8String?:"direct callback exception");}
    }catch(...){throw;}
   }});
  }@catch(NSException*e){throw std::runtime_error(e.reason.UTF8String?:"direct worker exception");}
 }catch(const directframe::Cancelled&){result.cancelled=true;result.success=true;}
 catch(const std::exception&e){result.success=false;result.failure=e.what();}
 auto stat=[](const directframe::OperationTiming&s)->NSDictionary*{return @{@"threadCPUAvailable":@(s.threadCPUAvailable),@"calls":@(s.calls),@"wall":@(s.wall),@"threadCPU":@(s.cpu),@"maxWall":@(s.maxWall),@"threadCPUAtMax":@(s.cpuAtMax),@"fieldAtMax":@(s.fieldAtMax)};};
 return @{@"operationProfile":@{@"enabled":@([m_[@"profileOperations"]boolValue]),@"io":stat(result.io),@"decode":stat(result.decode),@"filter":stat(result.filter),@"delivery":stat(result.delivery)},@"executionKind":@"in-process-avframe",@"generation":@(token_.generation),@"target":@(token_.target),@"single":@(single_),@"success":@(result.success),@"cancelled":@(result.cancelled),@"completedRequestedRange":@(result.rangeComplete),@"resourcesReleased":@(result.resourcesReleased),@"sourceIOError":@(result.sourceIOError),@"ioCloseStatus":@(result.ioCloseStatus),@"ioCloseAttempts":@(result.ioCloseAttempts),@"ioCancellationObserved":@(result.ioCancellationObserved),@"headerOpened":@(result.headerOpened),@"operationStatus":@(result.operationStatus),@"operation":[NSString stringWithUTF8String:result.operation.c_str()],@"failure":[NSString stringWithUTF8String:result.failure.c_str()],@"fields":@(result.fields),@"inputEOF":@(result.inputEOF),@"decoderEOF":@(result.decoderEOF),@"filterEOF":@(result.filterEOF),@"bytesRead":@(result.bytesRead),@"packets":@(result.packets),@"seconds":@(mono()-started),@"workerStartedMonotonic":@(started),@"stageTimings":stages,@"stageCount":@(stageCount),@"stageRingNext":@(stageCount%1200),@"surfaceHistoryTruncated":@(surfaceHistoryTruncated),@"poolWaits":@(poolWaits),@"distinctSurfaceIDs":@(surfaces.size()),@"cumulativeAllocationBytes":@(surfaceBytes),@"deferredImages":@([m_[@"deferredImages"]boolValue]),@"poolAllocationThreshold":@([m_[@"deferredImages"]boolValue]?4:32),@"poolMaximumBufferAge":@0,@"memoryScope":@"surface pool only; decoder/filter references additional",@"deliveryFrameLimit":@(diagnostic::MaxSurfaces),@"deliveryMaximumHeld":@(delivery_->maximum()),@"pid":@0};
}
@end
