#pragma once
#include "BufferedSeekPlan.hpp"
#include "../SourcePosition.hpp"
#include <optional>

namespace diagnostic {
// Selection follows the measured source clock, independent of display Hz.
inline std::optional<size_t> latestDueCandidate(
 const std::vector<BufferedFieldStamp>& fields,uint64_t generation,
 int64_t clockValue,int32_t clockScale,std::optional<int64_t> requiredTarget=std::nullopt){
 std::optional<size_t> selected;
 for(size_t i=0;i<fields.size();++i){const auto&f=fields[i];
  if(f.generation==generation&&(!requiredTarget||f.pts==*requiredTarget)&&
     nativeplayback::fieldDue(f.pts,clockValue,clockScale))selected=i;
 }
 return selected;
}

// Retire only already-admitted, superseded decoded candidates. The newest due
// field and all future fields remain available even when the consumer is slow.
// Transferred samples/GPU obligations are owned separately by SurfaceSender.
inline size_t supersededCandidatePrefix(
 const std::vector<BufferedFieldStamp>& fields,uint64_t session,uint64_t generation,
 int64_t coveredEnd,int64_t clockValue,int32_t clockScale,
 const nativeplayback::FieldTimeline& timeline,bool confirmedRunning){
 if(!confirmedRunning||!session||!generation||clockScale<=0||fields.empty()||fields.size()>32)return 0;
 int64_t previous=0;
 for(size_t i=0;i<fields.size();++i){const auto&f=fields[i];
  if(f.session!=session||f.generation!=generation||!f.decodedReady||!f.timingValidated||
     !timeline.contains(f.pts)||(i&&f.pts!=previous+nativeplayback::FieldStep))return 0;
  previous=f.pts;
 }
 auto selected=latestDueCandidate(fields,generation,clockValue,clockScale);
 if(!selected)return 0;
 for(size_t i=0;i<*selected;++i)if(fields[i].pts+nativeplayback::FieldStep>coveredEnd)return 0;
 return *selected;
}
}
