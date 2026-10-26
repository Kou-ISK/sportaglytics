#pragma once
#include <cstdint>
#include <cstddef>
#include <stdexcept>
namespace pcmwindow {
// Paused admission must fill the same bounded 1.2s queue used by the host.
constexpr int64_t PrerollSamples=57600;
// Loading has a separate deadline from admission to the renderer. Start one
// adjacent window while paused too; keep the same two-window/one-reader bound.
constexpr int64_t PrefetchSamples=86400;
constexpr int64_t Start=345553256,End=345913256,Chunk=1024,MaxWindow=120000;
inline bool coveredTarget(int64_t ticks){return ticks>=Start*5/2 && ticks<=End*5/2-24*1001;}
inline bool validRange(int64_t start,int64_t end){return start>=Start&&end>start&&end<=End&&end-start<=MaxWindow;}
inline size_t indexForSample(int64_t sample,int64_t start,int64_t end){if(!validRange(start,end)||sample<start||sample>=end)throw std::out_of_range("PCM target outside retained window");return (sample-start)/Chunk;}
inline bool contiguous(int64_t previousEnd,int64_t nextStart){return previousEnd==nextStart;}
}
