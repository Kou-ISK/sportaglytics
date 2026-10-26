#pragma once
#include <cstdint>
#include <algorithm>
namespace directframe {
// Fixed-size diagnostics: no per-frame event/trace history and no media bytes.
struct OperationTiming {
 uint64_t calls=0;bool threadCPUAvailable=true;
 double wall=0,cpu=0,maxWall=0,cpuAtMax=0;
 int64_t fieldAtMax=0;
 void add(double elapsed,double threadCPU,int64_t field){
  ++calls;wall+=elapsed;if(threadCPU<0){threadCPUAvailable=false;threadCPU=0;}cpu+=threadCPU;
  if(elapsed>maxWall){maxWall=elapsed;cpuAtMax=threadCPU;fieldAtMax=field;}
 }
};
}
