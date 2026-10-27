#pragma once
#include "NativePolicy.hpp"
#include <vector>
namespace diagnostic {
inline bool reserveEntryMatches(Request active,uint64_t session,uint64_t generation,bool retained,bool sampleValidated){return active.session==session&&active.generation==generation&&retained&&sampleValidated;}
struct Reserve {bool valid;int64_t end;bool enough;};
inline Reserve verifiedReserve(int64_t target,int64_t enqueuedEnd,const std::vector<int64_t>&pending,const nativeplayback::FieldTimeline& range=legacyTimeline()){
 if(!onGrid(target,range)||enqueuedEnd<target||enqueuedEnd>range.end||(enqueuedEnd-target)%Step||pending.size()>MaxSurfaces)return {false,0,false};
 int64_t end=enqueuedEnd;for(auto pts:pending){if(pts!=end||!onGrid(pts,range))return {false,0,false};end+=Step;}
 return {true,end,end>=target+24*Step};
}
}
