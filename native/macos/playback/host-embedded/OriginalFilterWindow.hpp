#pragma once
#include "NativePolicy.hpp"
namespace diagnostic {
// Qualified original: input frame clock 1/60000, phase0/step1001;
// output fields use 1/120000. Keep the prior input frame for bwdif's
// prev/cur/next pixels. The existing output trim still selects exact fields.
inline int64_t originalPrerollInputPTS(int64_t target,const nativeplayback::FieldTimeline& range) {
 if(!onGrid(target,range))throw std::out_of_range("unqualified original field target");
 static_assert(First%(2*Step)==0,"qualified input frame phase");
 return range.prerollInputPTS(target);
}
inline int64_t originalPrerollInputPTS(int64_t target) {
 if(!onGrid(target))throw std::out_of_range("unqualified legacy target");
 return (target/(2*Step)-1)*Step;
}
}
