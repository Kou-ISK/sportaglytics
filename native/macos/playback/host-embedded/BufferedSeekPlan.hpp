#pragma once
#include "../SourceTimeline.hpp"
#include <cstddef>
#include <cstdint>
#include <optional>
#include <vector>
namespace diagnostic {
struct BufferedFieldStamp {uint64_t session,generation;int64_t pts;bool decodedReady,timingValidated;};
class BufferedSeekPlan {
 BufferedSeekPlan(uint64_t s,uint64_t g,int64_t from,int64_t to,size_t prefix,size_t count):session(s),generation(g),previousTarget(from),target(to),discardPrefix(prefix),retainedCount(count){}
public:
 const uint64_t session,generation;const int64_t previousTarget,target;const size_t discardPrefix,retainedCount;
 // This proves availability of a stopped image, not permission to start playback.
 // The actual stopped clock must separately have the full playback reserve.
 static std::optional<BufferedSeekPlan> make(const std::vector<BufferedFieldStamp>&fields,uint64_t session,uint64_t generation,int64_t currentTarget,int64_t target,const nativeplayback::FieldTimeline&timeline){
  if(!session||!generation||fields.size()>32||fields.empty()||target<=currentTarget||!timeline.contains(currentTarget)||!timeline.contains(target))return std::nullopt;
  size_t first=fields.size();int64_t previous=-1;
  for(size_t i=0;i<fields.size();i++){const auto&f=fields[i];if(f.session!=session||f.generation!=generation||!f.decodedReady||!f.timingValidated||!timeline.contains(f.pts)||(i&&f.pts!=previous+nativeplayback::FieldStep))return std::nullopt;if(f.pts==target)first=i;previous=f.pts;}
  if(first==fields.size())return std::nullopt;
  return BufferedSeekPlan(session,generation,currentTarget,target,first,fields.size()-first);
 }
};
}
