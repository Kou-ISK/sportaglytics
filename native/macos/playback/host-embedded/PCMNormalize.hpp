#pragma once
#include <cstdint>
#include <stdexcept>
namespace localpcm {
struct Portion{int64_t offset,count,start,end;};
inline Portion normalize(int64_t count,int64_t pts,int64_t duration,int64_t output,int64_t outputDuration,int64_t front,int64_t back,int64_t expected){
 if(count<=0||count>16384||duration!=count||front<0||back<0||front>count||back>count-front||outputDuration!=count-front-back||output!=pts+front||output!=expected)throw std::logic_error("PCM trim/clock/continuity mismatch");
 return {front,outputDuration,output,output+outputDuration};
}
}
