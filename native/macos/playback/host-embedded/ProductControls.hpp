#pragma once
#import <Foundation/Foundation.h>
#include <cmath>
namespace diagnostic {
// Main-owned manifest opt-in; values such as numeric 1 or "true" must not
// widen the native command contract. The default remains muted-only.
inline bool unmutedTrialAllowed(id flag) {
 return flag && CFGetTypeID((__bridge CFTypeRef)flag)==CFBooleanGetTypeID() && [flag boolValue];
}
inline bool productControlsAllowed(double rate, double volume, bool muted, id trialFlag) {
 return rate==1 && (muted || unmutedTrialAllowed(trialFlag)) && std::isfinite(volume) && volume>=0 && volume<=1 && static_cast<double>(static_cast<float>(volume))==volume;
}
}
