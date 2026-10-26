#pragma once
#include "PrerollReserve.hpp"
namespace diagnostic {
// Image readiness is insufficient. Preserve 24 full fields of both supplies
// beyond the measured stopped clock, including its fractional-field position.
inline bool readyForProductStart(int64_t value,int32_t scale,double rate,
                                Reserve video,int64_t audioEnd,bool acknowledged){
 if(value<0||scale<=0||rate!=0||!video.valid||!acknowledged)return false;
 const __int128 required=(__int128)value*Scale+(__int128)24*Step*scale;
 return (__int128)video.end*scale>=required&&(__int128)audioEnd*scale>=required;
}
}
