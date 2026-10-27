#pragma once
#include <cstdint>
#include <algorithm>
namespace aacrange {
inline bool valid(int64_t pts,int64_t dts,int64_t duration,int64_t sourceEnd)noexcept{
 if(sourceEnd<=0||pts<-4096||pts>=sourceEnd||dts!=pts||pts>INT64_MAX-1024)return false;
 __int128 remain=static_cast<__int128>(sourceEnd)-pts;
 int64_t expected=remain<1024?static_cast<int64_t>(remain):1024;
 return duration==expected;
}
}
