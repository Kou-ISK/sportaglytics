#pragma once
#include <cmath>
namespace diagnostic {
enum class ReadyObservation {Waiting,Ready,Failed};
class StableAudioReady {bool began_=false,failed_=false;double since_=0,last_=0;
public:
 ReadyObservation observe(double now,bool targetClock,bool coverageReady){
  if(failed_||!std::isfinite(now)||(began_&&now<last_)){failed_=true;return ReadyObservation::Failed;}
  if(!targetClock||!coverageReady){if(began_){failed_=true;return ReadyObservation::Failed;}return ReadyObservation::Waiting;}
  if(!began_){began_=true;since_=now;}last_=now;return now-since_>=.25?ReadyObservation::Ready:ReadyObservation::Waiting;
 }
 double elapsed(double now)const{return began_&&!failed_&&now>=since_?now-since_:0;}
};}
