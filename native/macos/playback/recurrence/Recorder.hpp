#pragma once
#include <array>
#include <atomic>
#include <chrono>
#include <cstdint>
#include <memory>
#include <limits>
namespace recurrence {
constexpr uint64_t Magic=0x53504c5952454331ULL,Footer=0x53504c59454e4431ULL;
constexpr size_t NativeSlots=3392,MainSlots=704,RecordBytes=64;
constexpr size_t WireBytes=(1+4+NativeSlots+1)*RecordBytes;
constexpr size_t OwnedBufferBudget=(NativeSlots+MainSlots)*RecordBytes+32768+WireBytes+262144+65536+65536+256+64;
static_assert((NativeSlots+MainSlots)*RecordBytes==256*1024);
static_assert(OwnedBufferBudget<1024*1024);
static_assert(std::atomic<uint64_t>::is_always_lock_free);
using Row=std::array<uint64_t,8>;
// Every member is atomic: a concurrent overwritten slot is never a C++ data race.
// Sequentially consistent publication validates both reads of the commit word.
struct Slot {
 std::array<std::atomic<uint64_t>,8> words{};
 void store(const Row&r)noexcept{words[0].store(0);for(size_t i=1;i<8;i++)words[i].store(r[i]);words[0].store(r[0]);}
 bool load(Row&r)const noexcept{uint64_t before=words[0].load();if(!before){r={};return false;}for(size_t i=1;i<8;i++)r[i]=words[i].load();if(before!=words[0].load()){r={};return false;}r[0]=before;return true;}
};
static_assert(sizeof(Slot)==RecordBytes);
template<size_t N> class Ring {
 std::array<Slot,N> slots_{};std::atomic<uint64_t> count_{0};
public:
 // A ring has one writer; credit writers are serialized by a nonwaiting flag.
 void put(Row r)noexcept{uint64_t n=count_.load();if(n==std::numeric_limits<uint64_t>::max())return;r[0]=n+1;slots_[n%N].store(r);count_.store(n+1);}
 uint64_t count()const noexcept{return count_.load();}
 template<class Emit> bool dump(uint64_t group,Emit emit)const{
  const uint64_t count=count_.load(),kept=count<N?count:N,first=count-kept+1;
  if(!emit(Row{group,N,count,kept,kept?first:0,count,count> N?count-N:0,0}))return false;
  for(size_t i=0;i<N;i++){Row row{};if(i<kept){slots_[(first+i-1)%N].load(row);if(row[0]!=first+i)row={};}if(!emit(row))return false;}return true;
 }
};
class Recorder {
 Ring<2048> worker_;Ring<1024> owner_;Ring<256> credit_;Ring<64> resources_;
 std::atomic<uint64_t> failure_{0},creditDropped_{0};std::atomic_flag creditWriting_=ATOMIC_FLAG_INIT;uint64_t session_,origin_;
 static uint64_t now()noexcept{return std::chrono::duration_cast<std::chrono::nanoseconds>(std::chrono::steady_clock::now().time_since_epoch()).count();}
public:
 explicit Recorder(uint64_t session):session_(session),origin_(now()){}
 bool frozen()const noexcept{return failure_.load()!=0;}
 bool freeze(uint64_t reason)noexcept{uint64_t zero=0;return reason&&failure_.compare_exchange_strong(zero,reason);}
 void note(unsigned group,uint64_t event,uint64_t generation=0,uint64_t seek=0,int64_t pts=0,uint64_t value=0)noexcept{
  if(frozen())return;Row r{0,now()-origin_,event,session_,generation,seek,static_cast<uint64_t>(pts),value};
  switch(group){case 0:worker_.put(r);break;case 1:owner_.put(r);break;case 2:if(creditWriting_.test_and_set()){creditDropped_.fetch_add(1);return;}credit_.put(r);creditWriting_.clear();break;case 3:resources_.put(r);break;}
 }
 template<class Write> bool dump(Write write)const{
  if(!frozen())return false;
  std::array<uint64_t,4096> buffer{};size_t used=0;
  auto flush=[&]{if(!used)return true;bool ok=write(buffer.data(),used*sizeof(uint64_t));used=0;return ok;};
  auto emit=[&](const Row&r){for(auto n:r)buffer[used++]=n;return used==buffer.size()?flush():true;};
  if(!emit(Row{Magic,1,session_,failure_.load(),NativeSlots,WireBytes,creditDropped_.load(),0}))return false;
  if(!worker_.dump(0,emit)||!owner_.dump(1,emit)||!credit_.dump(2,emit)||!resources_.dump(3,emit))return false;
  return emit(Row{Footer,1,session_,failure_.load(),0,0,0,0})&&flush();
 }
};
static_assert(sizeof(Recorder)<220*1024);
// Initialized before media workers start; never reassigned during a process.
inline std::shared_ptr<Recorder> active;
inline void note(unsigned group,uint64_t event,uint64_t generation=0,uint64_t seek=0,int64_t pts=0,uint64_t value=0)noexcept{if(active)active->note(group,event,generation,seek,pts,value);}
void configure(bool enabled,uint64_t session)noexcept;
void capture(uint64_t reason)noexcept;
void resourceSample()noexcept;
}
