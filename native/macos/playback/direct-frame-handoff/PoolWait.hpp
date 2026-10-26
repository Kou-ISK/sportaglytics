#pragma once
#include "DirectFrameReader.hpp"
#include <stdexcept>
namespace directframe {
enum class Slot {acquired, pressure};
// The caller owns any acquired buffer before this returns or throws.
template<class Allocate,class Cancel,class Now,class Wait>
void acquireSlot(Allocate allocate,Cancel cancelled,double deadline,Now now,Wait wait){
 auto guard=[&]{if(cancelled())throw Cancelled{};if(now()>=deadline)throw std::runtime_error("surface pool deadline");};
 while(true){guard();auto slot=allocate();if(slot==Slot::acquired){guard();return;}wait();}
}
}
