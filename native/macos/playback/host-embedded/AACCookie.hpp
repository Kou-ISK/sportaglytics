#pragma once
#include <cstddef>
#include <cstdint>
#include <cstring>
namespace aaccookie {
struct Descriptor {uint8_t tag=0;size_t body=0,end=0;};
inline bool descriptor(const uint8_t*data,size_t size,size_t&cursor,Descriptor&out)noexcept{
 if(cursor>=size)return false;out.tag=data[cursor++];uint32_t length=0;
 for(unsigned i=0;i<4;i++){
  if(cursor>=size)return false;uint8_t byte=data[cursor++];length=(length<<7)|(byte&127);
  if(!(byte&128)){if(length>size-cursor)return false;out.body=cursor;out.end=cursor+length;cursor=out.end;return true;}
 }
 return false;
}
// Narrow original AAC-LC cookie profile. Unknown descriptor semantics fail closed.
inline bool matches(const uint8_t*data,size_t size,const uint8_t*asc,size_t ascSize)noexcept{
 if(!data||!asc||size>65536||ascSize!=2||asc[0]!=0x11||asc[1]!=0x90)return false;
 size_t at=0;Descriptor es,config,specific,sl;
 if(!descriptor(data,size,at,es)||es.tag!=3||es.end!=size||es.end-es.body<3||data[es.body+2]!=0)return false;
 at=es.body+3;if(!descriptor(data,es.end,at,config)||config.tag!=4||config.end-config.body<13||data[config.body]!=0x40||data[config.body+1]!=0x15)return false;
 size_t inner=config.body+13;if(!descriptor(data,config.end,inner,specific)||specific.tag!=5||specific.end-specific.body!=ascSize||inner!=config.end||std::memcmp(data+specific.body,asc,ascSize))return false;
 if(!descriptor(data,es.end,at,sl)||sl.tag!=6||sl.end-sl.body!=1||data[sl.body]!=2||at!=es.end)return false;
 return true;
}
}
