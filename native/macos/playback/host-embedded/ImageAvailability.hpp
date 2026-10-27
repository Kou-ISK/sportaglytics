#pragma once
#include "NativePolicy.hpp"
namespace diagnostic {
inline bool validImageObservation(bool cancelled,bool closing,bool healthy,bool stopped,size_t width,size_t height,size_t stride,bool bgra){return !cancelled&&!closing&&healthy&&stopped&&width==1920&&height==1080&&stride>=7680&&stride<=16384&&bgra;}
// Timing/ownership admission for renderer image availability, never a color/scanout proof.
class ImageAvailability {
 std::optional<Request> request_;bool clear_=false,enqueued_=false,observed_=false;
public:
 bool begin(Request r,bool clearCompleted,bool rawStopped){if(!clearCompleted||!rawStopped)return false;request_=r;clear_=true;enqueued_=observed_=false;return true;}
 bool enqueue(Request r,int64_t pts,bool sourceTimingValidated){if(!request_||!same(r,*request_)||!clear_||enqueued_||!sourceTimingValidated||pts!=r.target)return false;enqueued_=true;return true;}
 bool observe(Request r,bool rawStopped,bool imageAvailable){if(!request_||!same(r,*request_)||!clear_||!enqueued_||observed_||!rawStopped||!imageAvailable)return false;observed_=true;return true;}
 bool waiting()const{return enqueued_&&!observed_;}
 void cancel(){request_.reset();clear_=enqueued_=observed_=false;}
};}
