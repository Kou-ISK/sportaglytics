#pragma once
extern "C" {
#include <libavutil/error.h>
}
namespace directframe {
inline bool cancelledIO(int status,int underlying,bool observed,bool opening){
 if(!observed)return false;
 if(status==AVERROR_EXIT)return true;
 return opening&&underlying==AVERROR_EXIT&&(status==AVERROR_INVALIDDATA||status==AVERROR_EOF);
}
}
