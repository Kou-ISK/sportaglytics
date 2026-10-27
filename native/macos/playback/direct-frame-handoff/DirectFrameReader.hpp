#pragma once
#include <cstdint>
#include <functional>
#include <exception>
#include <string>
#include <optional>
#include "OperationTiming.hpp"
#include "../SourceTimeline.hpp"
extern "C" {
struct AVFrame;
#include <libavutil/rational.h>
struct AVFormatContext;
struct AVPacket;
}
namespace directframe {
class Cancelled final:public std::exception {public:const char* what()const noexcept override{return "requested cancellation";}};
struct Options {
 std::string source;
 int64_t target, end;
 double deadline;
 std::function<bool()> cancelled;
 std::optional<nativeplayback::FieldTimeline> timeline;
 bool streaming=false;
 bool profileOperations=false;
 uint64_t recurrenceGeneration=0;
};
struct Result {
 bool success=false,cancelled=false,rangeComplete=false,resourcesReleased=true;
 bool inputEOF=false,decoderEOF=false,filterEOF=false;
 bool sourceIOOpened=false,headerOpened=false,ioCancellationObserved=false;
 int sourceIOError=0,ioCloseStatus=0,operationStatus=0,ioCloseAttempts=0;
 std::string operation;
 size_t fields=0,packets=0;
 int64_t bytesRead=0;
 double seconds=0;
 OperationTiming io,decode,filter,delivery;
 std::string failure;
};
// The AVFrame is borrowed only for this callback. Do not retain its plane pointers.
using Field = std::function<void(const AVFrame&,int64_t,int64_t)>;
int64_t exactTicks(int64_t value, AVRational timebase);
using PacketRead = int (*)(AVFormatContext*,AVPacket*);
Result read(const Options& options,const Field& field,PacketRead packetReader=nullptr);
}
