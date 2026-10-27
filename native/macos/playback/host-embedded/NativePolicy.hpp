#pragma once
#include <cstdint>
#include <optional>
#include <stdexcept>
#include "BufferedSeekPlan.hpp"
#include "../SourceTimeline.hpp"
namespace diagnostic {
constexpr int64_t First=863702840, Step=1001, Scale=120000, Fields=1200;
constexpr size_t MaxSurfaces=32, MaxSurfaceBytes=100*1024*1024;
struct Request { uint64_t session,generation; int64_t target; unsigned track; };
inline bool same(const Request&a,const Request&b){return a.session==b.session&&a.generation==b.generation&&a.target==b.target&&a.track==b.track;}
inline const nativeplayback::FieldTimeline& legacyTimeline(){static const nativeplayback::FieldTimeline range(First,First+Fields*Step);return range;}
inline bool onGrid(int64_t pts,const nativeplayback::FieldTimeline& range=legacyTimeline()){return range.contains(pts);}
inline int64_t containingField(int64_t requested,const nativeplayback::FieldTimeline& range=legacyTimeline()){return range.containing(requested);}
// Pure ownership policy. Framework completion callbacks remain the actual owners' responsibility.
class Policy {
 std::optional<nativeplayback::FieldTimeline> source_;
 uint64_t generation_=0,session_=1,epoch_=0,workerEpoch_=0,issuedEpoch_=0;
 int direction_=0;bool firstScrubRequest_=false;
 std::optional<Request> desired_,worker_,issued_,display_,audio_;
 bool reusedWorker_=false;bool flushOwned_=false,failed_=false,closing_=false,scrubbing_=false;
public:
 void configure(const nativeplayback::FieldTimeline& source){if(source_||generation_||desired_)throw std::logic_error("source timeline already owned");source_.emplace(source);}
 const nativeplayback::FieldTimeline& timeline()const{return source_?*source_:legacyTimeline();}
 Request request(int64_t pts,unsigned track){
  if(failed_||closing_||track>2)throw std::logic_error("request rejected");
  reusedWorker_=false;int64_t target=containingField(pts,timeline());if(!firstScrubRequest_&&desired_&&target!=desired_->target){int next=target>desired_->target?1:-1;if(direction_&&next!=direction_)++epoch_;direction_=next;}
  firstScrubRequest_=false;desired_=Request{session_,++generation_,target,track};display_.reset();audio_.reset();return *desired_;
 }
 void beginScrub(){scrubbing_=true;direction_=0;firstScrubRequest_=true;++epoch_;}
 void endScrub(){scrubbing_=false;}
 void replaceSession(){reusedWorker_=false;++session_;++generation_;++epoch_;direction_=0;desired_.reset();display_.reset();audio_.reset();}
 void ownFlush(){if(flushOwned_)throw std::logic_error("overlapping flush");flushOwned_=true;}
 void closeFlush(bool confirmed){if(!flushOwned_)throw std::logic_error("unowned flush");if(confirmed)flushOwned_=false;else failed_=true;}
 std::optional<Request> issue(){
  if(failed_||closing_||worker_||flushOwned_||!desired_||(issued_&&same(*issued_,*desired_)))return std::nullopt;
  worker_=desired_;issued_=worker_;workerEpoch_=epoch_;issuedEpoch_=epoch_;return worker_;
 }
 std::optional<Request> reuse(const BufferedSeekPlan&plan,unsigned track){
  if(failed_||closing_||flushOwned_||scrubbing_||!worker_||!issued_||!desired_||!same(*issued_,*desired_)||!canResume()||track!=issued_->track||worker_->track!=track||worker_->session!=session_||plan.session!=session_||plan.generation!=issued_->generation||plan.previousTarget!=issued_->target||plan.target<=issued_->target)return std::nullopt;
  desired_=Request{session_,++generation_,plan.target,track};issued_=desired_;issuedEpoch_=epoch_;reusedWorker_=true;display_.reset();audio_.reset();return issued_;
 }
 std::optional<Request> presentationFor(const Request&token,int64_t pts)const{
  if(!worker_||!same(token,*worker_)||!issued_||!mayPresent(*issued_)||(!same(token,*issued_)&&!reusedWorker_)||token.session!=issued_->session||token.track!=issued_->track||!onGrid(pts,timeline())||pts<issued_->target)return std::nullopt;
  return issued_;
 }
 bool current(const Request&token)const{return !failed_&&!closing_&&desired_&&same(token,*desired_);}
 bool mayPresent(const Request&token)const{return current(token)||(scrubbing_&&issued_&&same(token,*issued_)&&token.session==session_&&issuedEpoch_==epoch_&&!failed_&&!closing_);}
 bool accept(const Request&token,int64_t pts)const{return presentationFor(token,pts).has_value();}
 void closeWorker(const Request&token,bool confirmed){
  if(!worker_||!same(token,*worker_))throw std::logic_error("unknown worker close");
  if(confirmed)worker_.reset();else failed_=true;
 }
 bool acknowledgeDisplayed(const Request&token,int64_t actual,bool flushAndEnqueueConfirmed,bool stoppedClockAtTarget){if(!issued_||!same(token,*issued_)||!mayPresent(token)||failed_||closing_||actual!=token.target||!flushAndEnqueueConfirmed||!stoppedClockAtTarget)return false;display_=token;return true;}
 bool acknowledgeAudio(const Request&token,unsigned track){if(!current(token)||track!=token.track)return false;audio_=token;return true;}
 bool canResume()const{return desired_&&display_&&audio_&&same(*desired_,*display_)&&same(*desired_,*audio_)&&!failed_&&!closing_&&!flushOwned_;}
 void fail(){reusedWorker_=false;failed_=true;display_.reset();audio_.reset();}
 void close(){reusedWorker_=false;closing_=true;desired_.reset();display_.reset();audio_.reset();}
 bool drained()const{return !worker_&&!flushOwned_;}
 bool failed()const{return failed_;}
 std::optional<Request> desired()const{return desired_;}
};
inline bool audioCoversTarget(bool ready,bool contiguous,int64_t start,int64_t end,int64_t target,int64_t forward){return ready&&contiguous&&start<=target&&end>=target+forward;}
inline bool completeRange(bool cancelled,bool rawEOF,bool metadataEOF,bool exited,int exitCode,size_t fields,size_t expected){return !cancelled&&rawEOF&&metadataEOF&&exited&&exitCode==0&&fields==expected;}
inline bool boundedSurfaceAllocation(size_t buffers,size_t bytes){return buffers<=MaxSurfaces&&bytes<=MaxSurfaceBytes;}
}
