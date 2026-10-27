#include "DirectFieldCopy.hpp"
extern "C" {
#include <libavutil/frame.h>
}
#include <cstring>
#include <stdexcept>
namespace directframe {
static void require(bool valid,const char*reason){if(!valid)throw std::runtime_error(reason);}
void copyToNV12(const AVFrame&f,CVPixelBufferRef p){
 require(p&&f.format==AV_PIX_FMT_YUV420P&&f.width==1920&&f.height==1080,"copy source dimensions");
 require(f.data[0]&&f.data[1]&&f.data[2]&&f.linesize[0]>=1920&&f.linesize[1]>=960&&f.linesize[2]>=960,"copy source planes");
 require(CVPixelBufferGetWidth(p)==1920&&CVPixelBufferGetHeight(p)==1080&&CVPixelBufferGetPixelFormatType(p)==kCVPixelFormatType_420YpCbCr8BiPlanarVideoRange&&CVPixelBufferGetPlaneCount(p)==2,"copy destination layout");
 require(CVPixelBufferGetWidthOfPlane(p,0)==1920&&CVPixelBufferGetHeightOfPlane(p,0)==1080&&CVPixelBufferGetWidthOfPlane(p,1)==960&&CVPixelBufferGetHeightOfPlane(p,1)==540,"copy destination planes");
 require(CVPixelBufferLockBaseAddress(p,0)==kCVReturnSuccess,"copy destination lock");
 try{
  auto*y=static_cast<unsigned char*>(CVPixelBufferGetBaseAddressOfPlane(p,0));auto*uv=static_cast<unsigned char*>(CVPixelBufferGetBaseAddressOfPlane(p,1));
  const size_t ys=CVPixelBufferGetBytesPerRowOfPlane(p,0),us=CVPixelBufferGetBytesPerRowOfPlane(p,1);
  require(y&&uv&&ys>=1920&&ys<=4096&&us>=1920&&us<=4096,"copy destination stride");
  for(size_t row=0;row<1080;row++)memcpy(y+row*ys,f.data[0]+row*f.linesize[0],1920);
  for(size_t row=0;row<540;row++)for(size_t x=0;x<960;x++){uv[row*us+2*x]=f.data[1][row*f.linesize[1]+x];uv[row*us+2*x+1]=f.data[2][row*f.linesize[2]+x];}
 }catch(...){CVPixelBufferUnlockBaseAddress(p,0);throw;}
 require(CVPixelBufferUnlockBaseAddress(p,0)==kCVReturnSuccess,"copy destination unlock");
}
}
