#include "AACCookie.hpp"
#include <array>
#include <cassert>
#include <cstdio>
int main(){
 std::array<uint8_t,27> cookie{3,25,0,2,0,4,17,0x40,0x15,0,0,0,0,0,0,0,0,0,0,0,5,2,0x11,0x90,6,1,2};
 uint8_t asc[]{0x11,0x90};auto good=[&](auto&c){return aaccookie::matches(c.data(),c.size(),asc,2);};assert(good(cookie));unsigned checks=1;
 for(size_t n=0;n<cookie.size();n++){assert(!aaccookie::matches(cookie.data(),n,asc,2));checks++;}
 for(size_t n:{0,1,4,5,6,7,8,20,21,22,23,24,25,26}){auto bad=cookie;bad[n]^=0x80;assert(!good(bad));checks++;}
 auto bad=cookie;bad[1]=0xff;bad[2]=0xff;bad[3]=0xff;bad[4]=0xff;assert(!good(bad));checks++;
 uint8_t changed[]{0x11,0x88};assert(!aaccookie::matches(cookie.data(),cookie.size(),changed,2));checks++;
 assert(!aaccookie::matches(nullptr,27,asc,2));assert(!aaccookie::matches(cookie.data(),cookie.size(),nullptr,2));checks+=2;
 std::printf("{\"passed\":true,\"checks\":%u}\n",checks);
}
