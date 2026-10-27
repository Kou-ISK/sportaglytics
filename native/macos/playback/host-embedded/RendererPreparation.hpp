#pragma once
#include <cstdint>
#include <optional>
#include <stdexcept>
#include "NativePolicy.hpp"
namespace diagnostic {
class RendererPreparation{
 uint64_t generation_=0;bool pending_=false,video_=false,audio_=false;
public:
 uint64_t begin(){if(pending_)throw std::logic_error("overlapping renderer preparation");pending_=true;video_=audio_=false;return ++generation_;}
 bool pending()const{return pending_;}
 uint64_t generation()const{return generation_;}
 bool ready()const{return pending_&&video_&&audio_;}
 bool videoReady(uint64_t g){if(!pending_||g!=generation_)return false;video_=true;return true;}
 bool audioReady(uint64_t g){if(!pending_||g!=generation_)return false;audio_=true;return true;}
 std::optional<Request> bindLatest(Request request,int64_t actualTarget,bool stopped,bool audioNeverFed){if(!ready()||!stopped||actualTarget!=request.target||!audioNeverFed)return std::nullopt;pending_=false;return request;}
};}
