#pragma once
#include "DirectFrameReader.hpp"
#include "../recurrence/Recorder.hpp"
#include <algorithm>
#include <chrono>
#include <condition_variable>
#include <memory>
#include <mutex>
#include <stdexcept>

namespace directframe {
// Counts logical frames, including callbacks queued for the owner. Pool
// allocation accounting is separate and is not a consumer queue contract.
class FrameDeliveryBudget {
 struct State {
  explicit State(size_t n):limit(n){}
  const size_t limit;
  size_t held=0,maximum=0;
  std::mutex mutex;
  std::condition_variable changed;
 };
 std::shared_ptr<State> state_;
public:
 class Permit {
  friend class FrameDeliveryBudget;
  std::shared_ptr<State> state_;uint64_t generation_;int64_t pts_;
 public:
  explicit Permit(std::shared_ptr<State> state,uint64_t generation,int64_t pts):state_(std::move(state)),generation_(generation),pts_(pts){}
  Permit(const Permit&)=delete;
  Permit& operator=(const Permit&)=delete;
  ~Permit(){
   {std::lock_guard<std::mutex> lock(state_->mutex);--state_->held;recurrence::note(2,43,generation_,0,pts_,state_->held);}
   state_->changed.notify_one();
  }
 };
 explicit FrameDeliveryBudget(size_t limit):state_(std::make_shared<State>(limit)){
  if(!limit)throw std::invalid_argument("empty frame delivery budget");
 }
 template<class Cancel,class Now>
 std::shared_ptr<Permit> acquire(Cancel cancelled,double deadline,Now now,uint64_t generation=0,int64_t pts=0){
  std::unique_lock<std::mutex> lock(state_->mutex);
  while(true){
   if(cancelled())throw Cancelled{};
   if(now()>=deadline)throw std::runtime_error("frame delivery deadline");
   if(state_->held<state_->limit){
    // Allocate the control block before changing accounting. A failed
    // allocation must not consume a slot or invoke a release without one.
    auto permit=std::make_shared<Permit>(state_,generation,pts);
    ++state_->held;recurrence::note(2,42,generation,0,pts,state_->held);state_->maximum=std::max(state_->maximum,state_->held);
    return permit;
   }
   state_->changed.wait_for(lock,std::chrono::milliseconds(2));
  }
 }
 void wake(){state_->changed.notify_all();}
 size_t held()const{std::lock_guard<std::mutex> lock(state_->mutex);return state_->held;}
 size_t maximum()const{std::lock_guard<std::mutex> lock(state_->mutex);return state_->maximum;}
};
}
