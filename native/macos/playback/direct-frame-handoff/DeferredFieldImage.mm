#import "DeferredFieldImage.hpp"
#import <CoreVideo/CoreVideo.h>
extern "C" {
#include <libavutil/frame.h>
}
#include <stdexcept>

namespace directframe {
struct ImagePool {
 CVPixelBufferPoolRef pool=nullptr;
 CMVideoFormatDescriptionRef format=nullptr;
 ~ImagePool(){if(format)CFRelease(format);if(pool)CVPixelBufferPoolRelease(pool);}
};
static void check(bool value,const char*reason){if(!value)throw std::runtime_error(reason);}
std::shared_ptr<ImagePool> makeImagePool(){
 auto p=std::make_shared<ImagePool>();
 NSDictionary*attrs=@{(id)kCVPixelBufferWidthKey:@1920,(id)kCVPixelBufferHeightKey:@1080,(id)kCVPixelBufferPixelFormatTypeKey:@(kCVPixelFormatType_420YpCbCr8BiPlanarVideoRange),(id)kCVPixelBufferIOSurfacePropertiesKey:@{}};
 check(CVPixelBufferPoolCreate(kCFAllocatorDefault,(__bridge CFDictionaryRef)@{(id)kCVPixelBufferPoolMinimumBufferCountKey:@4,(id)kCVPixelBufferPoolMaximumBufferAgeKey:@0},(__bridge CFDictionaryRef)attrs,&p->pool)==0&&p->pool,"deferred image pool create");
 return p;
}
}
@implementation DeferredFieldImage {
 AVFrame*field_;
 int64_t pts_,duration_;uint64_t bytes_;
 std::shared_ptr<directframe::ImagePool> pool_;
 CMSampleBufferRef sample_;
}
-(instancetype)initWithField:(const AVFrame&)field pts:(int64_t)pts duration:(int64_t)duration pool:(std::shared_ptr<directframe::ImagePool>)pool {
 directframe::check(pool&&field.buf[0]&&field.format==AV_PIX_FMT_YUV420P&&field.width==1920&&field.height==1080&&field.data[0]&&field.data[1]&&field.data[2]&&field.linesize[0]>=1920&&field.linesize[1]>=960&&field.linesize[2]>=960,"invalid retained decoded field");
 uint64_t bytes=0;for(auto*buffer:field.buf)if(buffer)bytes+=buffer->size;for(int i=0;i<field.nb_extended_buf;i++)bytes+=field.extended_buf[i]->size;
 directframe::check(bytes>0&&bytes<=100*1024*1024/32,"decoded field byte bound");
 if((self=[super init])){field_=av_frame_clone(&field);directframe::check(field_,"retain deferred field");bytes_=bytes;pts_=pts;duration_=duration;pool_=std::move(pool);}return self;
}
-(void)dealloc {if(sample_)CFRelease(sample_);av_frame_free(&field_);}
-(BOOL)prepared {return sample_!=nullptr;}
-(BOOL)decodedReady {return field_&&field_->buf[0];}
-(uint64_t)retainedBytes {return bytes_;}
-(CMSampleBufferRef)prepareSample {
 directframe::check(NSThread.isMainThread,"deferred preparation requires owner thread");
 if(sample_)return sample_;
 CVPixelBufferRef pixel=nullptr;
 CVReturn status=CVPixelBufferPoolCreatePixelBufferWithAuxAttributes(kCFAllocatorDefault,pool_->pool,(__bridge CFDictionaryRef)@{(id)kCVPixelBufferPoolAllocationThresholdKey:@4},&pixel);
 if(status==kCVReturnWouldExceedAllocationThreshold){directframe::check(!pixel,"deferred pressure returned pixel");return nullptr;}
 if(status!=0||!pixel)throw std::runtime_error("deferred pixel allocation status="+std::to_string(status));
 try {
  directframe::copyToNV12(*field_,pixel);
  CVBufferSetAttachments(pixel,(__bridge CFDictionaryRef)@{(id)kCVImageBufferColorPrimariesKey:(id)kCVImageBufferColorPrimaries_ITU_R_709_2,(id)kCVImageBufferTransferFunctionKey:(id)kCVImageBufferTransferFunction_ITU_R_709_2,(id)kCVImageBufferYCbCrMatrixKey:(id)kCVImageBufferYCbCrMatrix_ITU_R_709_2,(id)kCVImageBufferFieldCountKey:@1,(id)kCVImageBufferPixelAspectRatioKey:@{(id)kCVImageBufferPixelAspectRatioHorizontalSpacingKey:@1,(id)kCVImageBufferPixelAspectRatioVerticalSpacingKey:@1}},kCVAttachmentMode_ShouldPropagate);
  if(!pool_->format)directframe::check(CMVideoFormatDescriptionCreateForImageBuffer(kCFAllocatorDefault,pixel,&pool_->format)==0&&pool_->format,"deferred format");
  directframe::check(CMVideoFormatDescriptionMatchesImageBuffer(pool_->format,pixel),"deferred format changed");
  CMSampleTimingInfo timing={CMTimeMake(duration_,120000),CMTimeMake(pts_,120000),kCMTimeInvalid};
  directframe::check(CMSampleBufferCreateReadyWithImageBuffer(kCFAllocatorDefault,pixel,pool_->format,&timing,&sample_)==0&&sample_,"deferred timed sample");
 }catch(...){CVPixelBufferRelease(pixel);throw;}
 CVPixelBufferRelease(pixel);return sample_;
}
@end
