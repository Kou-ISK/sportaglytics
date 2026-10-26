#include "DirectFrameReader.hpp"
#include "IOCancellation.hpp"
#include "../recurrence/Recorder.hpp"
#include "../host-embedded/OriginalFilterWindow.hpp"
#include <chrono>
#include <algorithm>
#include <cmath>
#include <limits>
#include <stdexcept>
#include <time.h>
extern "C" {
#include <libavcodec/avcodec.h>
#include <libavformat/avformat.h>
#include <libavfilter/avfilter.h>
#include <libavfilter/buffersrc.h>
#include <libavfilter/buffersink.h>
#include <libavutil/avstring.h>
#include <libavutil/opt.h>
}
namespace directframe {
static double now(){return std::chrono::duration<double>(std::chrono::steady_clock::now().time_since_epoch()).count();}
static void require(bool valid,const char* reason){if(!valid)throw std::runtime_error(reason);}
static void checked(int value,const char* operation){if(value<0){char text[AV_ERROR_MAX_STRING_SIZE]{};av_strerror(value,text,sizeof(text));throw std::runtime_error(std::string(operation)+": "+text);}}
int64_t exactTicks(int64_t value,AVRational tb){
 require(value!=AV_NOPTS_VALUE&&tb.num>0&&tb.den>0,"missing or invalid source time");
 __int128 scaled=(__int128)value*tb.num*diagnostic::Scale;
 require(scaled%tb.den==0,"noninteger field time");scaled/=tb.den;
 require(scaled>=INT64_MIN&&scaled<=INT64_MAX,"field time overflow");return (int64_t)scaled;
}
struct State {
 const Options& options;Result& result;bool interruptCancellation=false,interruptDeadline=false;double ioDeadline=0;
 AVFormatContext* format=nullptr;AVCodecContext* codec=nullptr;
 AVIOContext* io=nullptr;AVDictionary* ioOptions=nullptr;
 AVFilterGraph* graph=nullptr;AVFilterContext* input=nullptr;AVFilterContext* output=nullptr;
 AVPacket* packet=nullptr;AVFrame* decoded=nullptr;AVFrame* filtered=nullptr;
 AVDictionary* openOptions=nullptr;AVFilterInOut* graphInput=nullptr;AVFilterInOut* graphOutput=nullptr;
 explicit State(const Options&o,Result&r):options(o),result(r){result.resourcesReleased=false;rearm();}
 const nativeplayback::FieldTimeline& timeline()const{return options.timeline?*options.timeline:diagnostic::legacyTimeline();}
 void rearm(){ioDeadline=options.streaming?now()+5:options.deadline;}
 ~State(){
  if(io){result.bytesRead=io->bytes_read;result.sourceIOError=io->error;}
  av_frame_free(&filtered);av_frame_free(&decoded);av_packet_free(&packet);
  avfilter_inout_free(&graphInput);avfilter_inout_free(&graphOutput);avfilter_graph_free(&graph);
  avcodec_free_context(&codec);avformat_close_input(&format);av_dict_free(&openOptions);av_dict_free(&ioOptions);
  if(io){
   // avio_close returns the saved read error even after a successful close.
   // Preserve it above, then isolate the single actual close outcome.
   io->error=0;++result.ioCloseAttempts;result.ioCloseStatus=avio_closep(&io);
  }
  result.resourcesReleased=result.ioCloseStatus>=0;
 }
 bool interrupted(){if(options.cancelled()){interruptCancellation=true;return true;}if(now()>=ioDeadline){interruptDeadline=true;return true;}return false;}
 static int interrupt(void* p) noexcept {try{return static_cast<State*>(p)->interrupted()?1:0;}catch(...){return 1;}}
 void guard()const{if(options.cancelled())throw Cancelled{};require(now()<ioDeadline,"direct decode deadline");}
 void ioChecked(int status,const char*operation,bool opening=false){
  if(status<0){result.operation=operation;result.operationStatus=status;result.ioCancellationObserved=interruptCancellation;}
  if(cancelledIO(status,io?io->error:0,interruptCancellation,opening))throw Cancelled{};
  if(status==AVERROR_EXIT&&interruptDeadline)throw std::runtime_error("direct decode deadline");checked(status,operation);
 }
};
struct OperationScope {
 State& state;OperationTiming& stats;double began=0,cpu=0;uint64_t stage;
 int64_t expected()const{return state.options.target+state.result.fields*diagnostic::Step;}
 static double cpuNow(){timespec t{};if(clock_gettime(CLOCK_THREAD_CPUTIME_ID,&t))return -1;return double(t.tv_sec)+double(t.tv_nsec)/1e9;}
 OperationScope(State&s,OperationTiming&t):state(s),stats(t),stage(&t==&s.result.io?10:&t==&s.result.decode?12:&t==&s.result.filter?14:16){recurrence::note(0,stage,state.options.recurrenceGeneration,0,expected());if(state.options.profileOperations){began=now();cpu=cpuNow();}}
 ~OperationScope(){recurrence::note(0,stage+1,state.options.recurrenceGeneration,0,expected());if(state.options.profileOperations){double finishedCPU=cpuNow();stats.add(now()-began,cpu<0||finishedCPU<0?-1:finishedCPU-cpu,state.options.target+state.result.fields*diagnostic::Step);}}
};
template<class F> static auto timed(State&s,OperationTiming&t,F work){OperationScope scope(s,t);return work();}
static void validateField(const AVFrame& f,bool progressive=true){
 require(f.width==1920&&f.height==1080&&f.format==AV_PIX_FMT_YUV420P,"unqualified field layout");
 require((!progressive||!(f.flags&AV_FRAME_FLAG_INTERLACED))&&!(f.flags&AV_FRAME_FLAG_CORRUPT)&&f.decode_error_flags==0,"field flags/error");
 require(f.sample_aspect_ratio.num==1&&f.sample_aspect_ratio.den==1,"field sample aspect");
 require(f.color_range==AVCOL_RANGE_MPEG&&f.colorspace==AVCOL_SPC_BT709&&f.color_primaries==AVCOL_PRI_BT709&&f.color_trc==AVCOL_TRC_BT709,"field color metadata");
 require(f.data[0]&&f.data[1]&&f.data[2]&&f.linesize[0]>=1920&&f.linesize[1]>=960&&f.linesize[2]>=960,"field plane bounds");
}
static int prepare(State&s){
 s.guard();s.format=avformat_alloc_context();require(s.format,"format allocation");s.format->interrupt_callback={State::interrupt,&s};
 checked(av_dict_set(&s.ioOptions,"protocol_whitelist","file",0),"source IO restriction");
 s.ioChecked(avio_open2(&s.io,s.options.source.c_str(),AVIO_FLAG_READ,&s.format->interrupt_callback,&s.ioOptions),"open source IO");
 s.result.sourceIOOpened=true;require(av_dict_count(s.ioOptions)==0,"unconsumed IO restriction");
 s.format->pb=s.io;s.format->flags|=AVFMT_FLAG_CUSTOM_IO;
 for(auto pair:{std::pair<const char*,const char*>{"protocol_whitelist","file"},{"format_whitelist","mov"},{"enable_drefs","0"},{"use_absolute_path","0"}})checked(av_dict_set(&s.openOptions,pair.first,pair.second,0),"source option");
 s.interruptCancellation=false;s.interruptDeadline=false;
 s.ioChecked(avformat_open_input(&s.format,s.options.source.c_str(),av_find_input_format("mov"),&s.openOptions),"open original",true);
 s.result.headerOpened=true;require(s.format->pb==s.io&&(s.format->flags&AVFMT_FLAG_CUSTOM_IO),"source IO ownership changed");
 require(av_dict_count(s.openOptions)==0,"unconsumed source restrictions");s.guard();
 int video=-1;for(unsigned i=0;i<s.format->nb_streams;i++)if(s.format->streams[i]->codecpar->codec_type==AVMEDIA_TYPE_VIDEO){video=(int)i;break;}
 require(video>=0,"video stream missing");AVStream* stream=s.format->streams[video];
 require(stream->codecpar->codec_id==AV_CODEC_ID_H264&&stream->codecpar->width==1920&&stream->codecpar->height==1080&&stream->codecpar->extradata_size>0,"unqualified original video");
 require(stream->time_base.num==1&&stream->time_base.den==60000,"original input timebase changed");
 require(av_cmp_q(stream->avg_frame_rate,AVRational{60000,1001})==0,"original frame rate changed");
 for(unsigned i=0;i<s.format->nb_streams;i++)if((int)i!=video)s.format->streams[i]->discard=AVDISCARD_ALL;
 const AVCodec* decoder=avcodec_find_decoder(AV_CODEC_ID_H264);require(decoder,"H264 decoder unavailable");
 s.codec=avcodec_alloc_context3(decoder);require(s.codec,"decoder allocation");checked(avcodec_parameters_to_context(s.codec,stream->codecpar),"decoder parameters");
 s.codec->pkt_timebase=stream->time_base;s.codec->thread_count=4;s.codec->err_recognition=AV_EF_CRCCHECK|AV_EF_BITSTREAM|AV_EF_BUFFER|AV_EF_EXPLODE;
 checked(avcodec_open2(s.codec,decoder,nullptr),"decoder open");
 const int64_t seek=av_rescale_q(std::max(s.options.timeline?s.timeline().first:int64_t(0),s.options.target-2*diagnostic::Step),AVRational{1,120000},AV_TIME_BASE_Q);
 s.rearm();
 s.ioChecked(avformat_seek_file(s.format,-1,INT64_MIN,seek,seek,0),"bounded source seek");avcodec_flush_buffers(s.codec);
 s.packet=av_packet_alloc();s.decoded=av_frame_alloc();s.filtered=av_frame_alloc();require(s.packet&&s.decoded&&s.filtered,"packet/frame allocation");
 s.graph=avfilter_graph_alloc();require(s.graph,"filter graph allocation");s.graph->nb_threads=1;
 std::string args="video_size=1920x1080:pix_fmt="+std::to_string(AV_PIX_FMT_YUV420P)+":time_base=1/60000:pixel_aspect=1/1:frame_rate=60000/1001:colorspace=bt709:range=tv";
 checked(avfilter_graph_create_filter(&s.input,avfilter_get_by_name("buffer"),"source",args.c_str(),nullptr,s.graph),"filter input");
 checked(avfilter_graph_create_filter(&s.output,avfilter_get_by_name("buffersink"),"fields",nullptr,nullptr,s.graph),"filter output");
 s.graphInput=avfilter_inout_alloc();s.graphOutput=avfilter_inout_alloc();require(s.graphInput&&s.graphOutput,"filter links allocation");
 s.graphInput->name=av_strdup("out");s.graphInput->filter_ctx=s.output;s.graphInput->pad_idx=0;
 s.graphOutput->name=av_strdup("in");s.graphOutput->filter_ctx=s.input;s.graphOutput->pad_idx=0;require(s.graphInput->name&&s.graphOutput->name,"filter link names");
 std::string filters="trim=start_pts="+std::to_string((s.options.timeline?diagnostic::originalPrerollInputPTS(s.options.target,s.timeline()):diagnostic::originalPrerollInputPTS(s.options.target)))+",bwdif=mode=send_field:parity=auto:deint=all,trim=start_pts="+std::to_string(s.options.target)+":end_pts="+std::to_string(s.options.end);
 checked(avfilter_graph_parse_ptr(s.graph,filters.c_str(),&s.graphInput,&s.graphOutput,nullptr),"filter parse");checked(avfilter_graph_config(s.graph,nullptr),"filter configure");
 require(av_cmp_q(av_buffersink_get_time_base(s.output),AVRational{1,120000})==0,"output field timebase");
 // No find_stream_info/full-media probe: this qualified MOV header carries the
 // decoder parameters and frame clock. Actual decoded fields are checked below.
 return video;
}
static void drainFields(State&s,const Field&field){
 const AVRational tb=av_buffersink_get_time_base(s.output);
 while(!s.result.rangeComplete){
  s.guard();int status=timed(s,s.result.filter,[&]{return av_buffersink_get_frame(s.output,s.filtered);});
  if(status==AVERROR(EAGAIN))return;
  if(status==AVERROR_EOF){s.result.filterEOF=true;return;}
  checked(status,"filtered field");validateField(*s.filtered);
  const int64_t pts=exactTicks(s.filtered->pts,tb),duration=exactTicks(s.filtered->duration,tb);
  require(pts==s.options.target+(int64_t)s.result.fields*diagnostic::Step&&duration==diagnostic::Step,"field order/clock/duration");
  require(pts<s.options.end,"extra field");timed(s,s.result.delivery,[&]{field(*s.filtered,pts,duration);});
  ++s.result.fields;av_frame_unref(s.filtered);s.rearm();s.guard();
  s.result.rangeComplete=s.result.fields==(size_t)((s.options.end-s.options.target)/diagnostic::Step);
 }
}
static void drainDecoder(State&s,const Field&field){
 while(!s.result.rangeComplete){
  s.guard();int status=timed(s,s.result.decode,[&]{return avcodec_receive_frame(s.codec,s.decoded);});
  if(status==AVERROR_EOF){s.result.decoderEOF=true;checked(timed(s,s.result.filter,[&]{return av_buffersrc_add_frame_flags(s.input,nullptr,0);}),"filter EOF input");drainFields(s,field);return;}
  if(status==AVERROR(EAGAIN))return;checked(status,"decoded frame");
  require(s.decoded->pts!=AV_NOPTS_VALUE&&s.decoded->duration>0&&s.decoded->decode_error_flags==0&&!(s.decoded->flags&AV_FRAME_FLAG_CORRUPT),"decoded source timestamp/error");
  validateField(*s.decoded,false);
  checked(timed(s,s.result.filter,[&]{return av_buffersrc_add_frame_flags(s.input,s.decoded,AV_BUFFERSRC_FLAG_KEEP_REF);}),"filter frame");av_frame_unref(s.decoded);
  drainFields(s,field);
 }
}

Result read(const Options&o,const Field&field,PacketRead packetReader){
 Result result;double started=now();
 try{
  const auto& timeline=o.timeline?*o.timeline:diagnostic::legacyTimeline();
  require(timeline.contains(o.target)&&o.end>o.target&&o.end<=timeline.end&&(o.end-o.target)%diagnostic::Step==0,"unqualified field range");
  require(!o.source.empty()&&o.source[0]=='/'&&o.cancelled&&field,"direct source/callback contract");
  require(std::isfinite(o.deadline),"finite decode deadline required");Options bounded=o;if(!o.streaming)bounded.deadline=std::min(o.deadline,started+30.0);
  State state(bounded,result);const int video=prepare(state);
  recurrence::note(0,19,o.recurrenceGeneration,video,state.format->streams[video]->time_base.num,state.format->streams[video]->time_base.den);
  size_t lastFields=0,packetsWithoutField=0;
  while(!result.rangeComplete){
   state.rearm();state.guard();const int status=timed(state,result.io,[&]{return (packetReader?packetReader:av_read_frame)(state.format,state.packet);});
   if(status==AVERROR_EOF){
    result.inputEOF=true;checked(timed(state,result.decode,[&]{return avcodec_send_packet(state.codec,nullptr);}),"decoder EOF input");drainDecoder(state,field);
    require(result.rangeComplete,"source EOF before requested field range");break;
   }
   state.ioChecked(status,"source packet");++result.packets;
   if(result.fields!=lastFields){packetsWithoutField=0;lastFields=result.fields;}
   require(++packetsWithoutField<=10000,"bounded packets without field progress");
   if(state.packet->stream_index!=video){av_packet_unref(state.packet);continue;}
   recurrence::note(0,18,state.options.recurrenceGeneration,state.packet->stream_index,state.packet->pts,state.packet->size);
   checked(timed(state,result.decode,[&]{return avcodec_send_packet(state.codec,state.packet);}),"decoder packet");av_packet_unref(state.packet);
   drainDecoder(state,field);
  }
 }catch(const Cancelled&){result.cancelled=true;}catch(const std::exception&e){result.failure=e.what();}
 if(!result.resourcesReleased&&result.failure.empty())result.failure="source IO close unconfirmed";
 result.seconds=now()-started;result.success=result.failure.empty()&&result.resourcesReleased&&(result.cancelled||result.rangeComplete);return result;
}
}
