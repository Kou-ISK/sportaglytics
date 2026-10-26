#include "SurfaceCandidateRetention.hpp"
#include <cassert>

using namespace diagnostic;
int main() {
 const nativeplayback::FieldTimeline timeline(0,1001000);
 std::vector<BufferedFieldStamp> fields;
 for(int i=0;i<32;++i)fields.push_back({1,2,35035+i*1001,true,true});
 const auto prefix=[&](const std::vector<BufferedFieldStamp>& input,int64_t end,
                       int64_t value,int32_t scale,bool running=true){
  return supersededCandidatePrefix(input,1,2,end,value,scale,timeline,running);
 };
 // All 32 candidates have been admitted and are now past the source clock.
 // Keep the newest image while allowing the producer to use the other slots.
 assert(prefix(fields,67067,67264,120000)==31);
 assert(prefix(fields,67067,67264,120000,false)==0);
 assert(latestDueCandidate(fields,2,67264,120000)==31);
 // Every future field stays available. A clock just before a field must not
 // round forward, even at a high clock resolution or display refresh rate.
 assert(prefix(fields,67067,50050*1000-1,120000000)==14);
 assert(prefix(fields,67067,50050*1000,120000000)==15);
 assert(prefix(fields,67067,50050*1000+1,120000000)==15);
 assert(prefix(fields,67067,35034,120000)==0);
 assert(prefix(fields,67067,35035,120000)==0);
 assert(prefix(fields,67067,-1,120000)==0);
 assert(prefix(fields,67067,67264,0)==0);
 assert(!latestDueCandidate(fields,3,67264,120000));
 assert(latestDueCandidate(fields,2,67264,120000,35035)==0);
 assert(!latestDueCandidate(fields,2,67264,120000,70070));
 // Coverage must include the entire prefix, not merely its start timestamp.
 assert(prefix(fields,65065,67264,120000)==0);
 assert(prefix(fields,66065,67264,120000)==0);
 assert(prefix(fields,66066,67264,120000)==31);
 for(size_t i=0;i<fields.size();++i){
  auto bad=fields;bad[i].session=9;assert(prefix(bad,67067,67264,120000)==0);
  bad=fields;bad[i].generation=9;assert(prefix(bad,67067,67264,120000)==0);
  bad=fields;bad[i].decodedReady=false;assert(prefix(bad,67067,67264,120000)==0);
  bad=fields;bad[i].timingValidated=false;assert(prefix(bad,67067,67264,120000)==0);
  bad=fields;bad[i].pts+=1;assert(prefix(bad,67067,67264,120000)==0);
 }
 auto gap=fields;gap.erase(gap.begin()+8);assert(prefix(gap,67067,67264,120000)==0);
 auto reordered=fields;std::swap(reordered[0],reordered[1]);assert(prefix(reordered,67067,67264,120000)==0);
 auto excess=fields;excess.push_back({1,2,67067,true,true});assert(prefix(excess,68068,69069,120000)==0);
 assert(prefix({},67067,67264,120000)==0);
 assert(supersededCandidatePrefix(fields,0,2,67067,67264,120000,timeline,true)==0);
 assert(supersededCandidatePrefix(fields,1,0,67067,67264,120000,timeline,true)==0);
 // After retirement, a subsequent pause and forward buffered seek can still
 // use every future field at its original timestamp. No fields are fabricated.
 const auto count=prefix(fields,67067,50050,120000);
 fields.erase(fields.begin(),fields.begin()+count);
 assert(fields.size()==17&&fields.front().pts==50050&&fields.back().pts==66066);
 assert(prefix(fields,67067,50050,120000,false)==0);
 auto seek=BufferedSeekPlan::make(fields,1,2,50050,55055,timeline);
 assert(seek&&seek->discardPrefix==5&&seek->retainedCount==12);
 assert(!BufferedSeekPlan::make(fields,1,2,50050,49049,timeline));
}
