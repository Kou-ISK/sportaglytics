#pragma once
#include <cstdint>
#include <cmath>
namespace diagnostic {
struct MetricSnapshot {
 uint64_t command,sequence,generation;double time,rate;
 bool stopped() const{return std::isfinite(time)&&time>=0&&rate==0;}
 bool matches(const MetricSnapshot& other)const{return stopped()&&other.stopped()&&command==other.command&&sequence==other.sequence&&generation==other.generation&&time==other.time;}
};
inline bool mayDispatchProductCommands(unsigned pendingMetrics){return pendingMetrics==0;}
}
