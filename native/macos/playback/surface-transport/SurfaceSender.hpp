#pragma once
#import <CoreVideo/CoreVideo.h>
#include <IOSurface/IOSurface.h>
#include <servers/bootstrap.h>
#include <map>
#include <stdexcept>
#include "SurfaceWire.hpp"
#include "PixelReference.hpp"
#include "../frame-ownership/FrameLease.hpp"
#include <type_traits>
class SurfaceBudgetUnavailable : public std::runtime_error {
public:
 SurfaceBudgetUnavailable() : std::runtime_error("surface transfer budget unavailable") {}
};
class SurfaceSender {
 using Pixel = std::remove_pointer_t<CVPixelBufferRef>;
 using LeasedPixel = appleplayback::RetainedImage<Pixel>;
 // Destroy the sender's extra pixel reference before returning the budget
 // lease. Drawn alone does not relinquish either ownership.
 struct Held { LeasedPixel lease;PixelReference image;uint64_t generation,pts; };
 appleplayback::FrameBudget budget_;
 mach_port_t server_=0,receiver_=0;pid_t peer_=0;bool demand_=false;uint64_t serial_=0,drawGeneration_=0,drawPTS_=0;std::map<uint64_t,Held> held_;
public:
 // Current v1 owns at most three qualified 1080p NV12 transfers (~10MiB in
 // measured buffers). 64MiB is finite allocation headroom, not total memory.
 // A future group supplies the SAME budget as its cache/other angle senders.
 explicit SurfaceSender(appleplayback::FrameBudget budget=appleplayback::FrameBudget(64ULL*1024*1024)) : budget_(std::move(budget)) {}
 void open(const char* name,pid_t peer){
  if(server_||peer<=0)throw std::runtime_error("invalid surface peer");peer_=peer;
  if(bootstrap_look_up(bootstrap_port,name,&server_)!=KERN_SUCCESS||mach_port_allocate(mach_task_self(),MACH_PORT_RIGHT_RECEIVE,&receiver_)!=KERN_SUCCESS)throw std::runtime_error("surface connection failed");
  if(surfacewire::configureReplyQueue(receiver_)!=KERN_SUCCESS)throw std::runtime_error("surface reply queue configuration failed");
 }
private:
 bool sendOwned(CVPixelBufferRef image,uint64_t generation,uint64_t seek,uint64_t pts,LeasedPixel lease){
  if(!surfacewire::hasFrameCredit(held_.size()))return false;
  IOSurfaceRef surface=image?CVPixelBufferGetIOSurface(image):nullptr;
  if(!surface)throw std::runtime_error("missing surface");
  // Keep the existing receiver's qualified layout without manufacturing a
  // CMSampleBuffer/format description that the surface transport never uses.
  if(CVPixelBufferGetWidth(image)!=1920||CVPixelBufferGetHeight(image)!=1080||
     CVPixelBufferGetPixelFormatType(image)!=kCVPixelFormatType_420YpCbCr8BiPlanarVideoRange||CVPixelBufferGetPlaneCount(image)!=2||
     IOSurfaceGetWidth(surface)!=1920||IOSurfaceGetHeight(surface)!=1080||
     IOSurfaceGetPixelFormat(surface)!='420v'||IOSurfaceGetPlaneCount(surface)!=2)
    throw std::runtime_error("unexpected surface layout");
  mach_port_t port=IOSurfaceCreateMachPort(surface);if(!port)throw std::runtime_error("surface port failed");surfacewire::FrameMessage m{};
  m.header.msgh_bits=MACH_MSGH_BITS_COMPLEX|MACH_MSGH_BITS(MACH_MSG_TYPE_COPY_SEND,0);m.header.msgh_size=sizeof(m);m.header.msgh_remote_port=server_;m.header.msgh_id=surfacewire::Frame;m.body.msgh_descriptor_count=2;
  m.surface.name=port;m.surface.disposition=MACH_MSG_TYPE_COPY_SEND;m.surface.type=MACH_MSG_PORT_DESCRIPTOR;
  m.reply.name=receiver_;m.reply.disposition=MACH_MSG_TYPE_MAKE_SEND;m.reply.type=MACH_MSG_PORT_DESCRIPTOR;
  m.id=++serial_;m.generation=generation;m.seek=seek;m.pts=pts;
  try { held_.emplace(m.id,Held{std::move(lease),PixelReference(image),generation,pts}); }
  catch (...) { mach_port_deallocate(mach_task_self(),port);throw; }
  auto r=mach_msg(&m.header,MACH_SEND_MSG|MACH_SEND_TIMEOUT,sizeof(m),0,0,0,0);mach_port_deallocate(mach_task_self(),port);
  if(r!=KERN_SUCCESS){held_.erase(m.id);throw std::runtime_error("surface send failed");}return true;
 }
public:
 bool send(CVPixelBufferRef image,uint64_t generation,uint64_t seek,uint64_t pts){
  if(!surfacewire::hasFrameCredit(held_.size()))return false;
  if(!image)throw std::runtime_error("missing surface");
  auto lease=budget_.retainImage(appleplayback::OwnedImage<Pixel>(CVPixelBufferRetain(image),
      [](Pixel* value){CVPixelBufferRelease(value);}),CVPixelBufferGetDataSize(image));
  if(!lease)throw SurfaceBudgetUnavailable{};
  return sendLeased(*lease,generation,seek,pts);
 }
 // Source/control timestamp validation remains the caller's responsibility.
 // The pixel and its charged lease cannot be supplied as unrelated arguments.
 bool sendLeased(const LeasedPixel& frame,uint64_t generation,uint64_t seek,uint64_t pts){
  if(!frame.image())throw std::runtime_error("invalid frame lease");
  if(!budget_.owns(frame))throw std::runtime_error("foreign frame budget");
  if(budget_.quarantinedBytes())throw SurfaceBudgetUnavailable{};
  return sendOwned(frame.image(),generation,seek,pts,frame);
 }
 void poll(){
  if(!receiver_)return;
  for(size_t i=0;i<surfacewire::Limit*2;i++){
   surfacewire::Receive<surfacewire::Ack> b{};auto r=mach_msg(&b.message.header,surfacewire::receiveOptions(),0,sizeof(b),receiver_,0,0);
   if(r==MACH_RCV_TIMED_OUT)return;if(r!=KERN_SUCCESS)throw std::runtime_error("surface ack receive failed");auto& a=b.message;
   if(surfacewire::fromPeer(&a.header,sizeof(a),peer_)&&!(a.header.msgh_bits&MACH_MSGH_BITS_COMPLEX)&&a.header.msgh_id==surfacewire::Request&&a.id==0){demand_=true;continue;}
   if(!surfacewire::fromPeer(&a.header,sizeof(a),peer_)||(a.header.msgh_bits&MACH_MSGH_BITS_COMPLEX)||!held_.count(a.id)||(a.header.msgh_id!=surfacewire::Drawn&&a.header.msgh_id!=surfacewire::Released)){mach_msg_destroy(&a.header);throw std::runtime_error("invalid surface ack");}
   const auto& h=held_.at(a.id);if(a.header.msgh_id==surfacewire::Drawn){drawGeneration_=h.generation;drawPTS_=h.pts;}else{held_.erase(a.id);}
  }
 }
 bool hasDrawn(uint64_t generation) const {return drawGeneration_==generation;}
 uint64_t drawnPTS() const {return drawPTS_;}
 bool demanded() const {return demand_;}
 uint64_t nextID() const {return serial_+1;}
 void consumedDemand(){demand_=false;}
 bool drawn(uint64_t generation,uint64_t pts) const { return drawGeneration_==generation&&drawPTS_==pts; }
 size_t pending() const {return held_.size();}
 ~SurfaceSender(){
  // A destroyed reply channel can no longer prove remote/GPU release. Other
  // senders sharing this budget must not spend those unconfirmed bytes again.
  for(const auto& item:held_)item.second.lease.quarantine();
  held_.clear();if(receiver_)mach_port_mod_refs(mach_task_self(),receiver_,MACH_PORT_RIGHT_RECEIVE,-1);if(server_)mach_port_deallocate(mach_task_self(),server_);
 }
};
