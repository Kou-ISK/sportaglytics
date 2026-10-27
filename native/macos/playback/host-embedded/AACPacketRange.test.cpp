#include "AACPacketRange.hpp"
#include <cassert>
#include <cstdio>
int main(){using aacrange::valid;
 assert(valid(-1600,-1600,1024,120000));assert(valid(-576,-576,1024,120000));assert(valid(0,0,1024,120000));assert(valid(119808,119808,192,120000));
 assert(!valid(0,0,1,120000));assert(!valid(1024,1024,1023,120000));assert(!valid(119808,119808,1024,120000));assert(!valid(119808,119808,191,120000));assert(!valid(120000,120000,1,120000));assert(!valid(0,1,1024,120000));assert(!valid(INT64_MIN,INT64_MIN,1024,120000));assert(!valid(INT64_MAX,INT64_MAX,1,INT64_MAX));assert(!valid(0,0,1024,0));
 std::puts("{\"passed\":true,\"checks\":13,\"nonterminalShortRejected\":true}");}
