#include "FiniteAACInput.hpp"
#include "AACPacketRange.hpp"
extern std::atomic<bool> nativeInterrupted;
#include <algorithm>
#include <chrono>
#include <stdexcept>
#include <climits>
extern "C" {
#include <libavformat/avformat.h>
#include <libavcodec/packet.h>
#include <libavutil/intreadwrite.h>
}
namespace finiteaac {
static double now(){return std::chrono::duration<double>(std::chrono::steady_clock::now().time_since_epoch()).count();}
static void need(bool ok,const char*reason){if(!ok)throw std::runtime_error(reason);}
struct Demux {
 AVFormatContext*format=nullptr;AVPacket*packet=nullptr;AVDictionary*opts=nullptr;AVDictionary*ioOpts=nullptr;AVIOContext*io=nullptr;double deadline=0;std::atomic<bool>&cancel;Result&result;
 explicit Demux(std::atomic<bool>&c,Result&r,double end):deadline(end),cancel(c),result(r){}
 void close(){
  av_packet_free(&packet);avformat_close_input(&format);av_dict_free(&opts);av_dict_free(&ioOpts);
  if(io){result.ioBytes=io->bytes_read;result.sourceIOError=io->error;io->error=0;++result.closeAttempts;result.closeStatus=avio_closep(&io);}
 }
 ~Demux(){close();}
 static int interrupt(void*p){auto*s=static_cast<Demux*>(p);return s->cancel||nativeInterrupted||now()>=s->deadline||(s->io&&s->io->bytes_read>48*1024*1024);}
};
Result read(const std::string&source,int64_t start,int64_t end,std::atomic<bool>&cancel,int64_t sourceEnd,double deadline){
 need(start>=0&&end>start&&end-start<=168000&&!source.empty()&&source[0]=='/',"finite original range");
 Result result;Demux d(cancel,result,deadline);double began=now();need(!cancel&&!nativeInterrupted&&began<deadline&&end<=sourceEnd,"cancelled/expired/range");d.format=avformat_alloc_context();need(d.format,"format allocation");d.format->interrupt_callback={Demux::interrupt,&d};
 need(av_dict_set(&d.ioOpts,"protocol_whitelist","file",0)==0,"IO restriction");
 need(avio_open2(&d.io,source.c_str(),AVIO_FLAG_READ,&d.format->interrupt_callback,&d.ioOpts)>=0&&av_dict_count(d.ioOpts)==0,"source IO open");
 d.format->pb=d.io;d.format->flags|=AVFMT_FLAG_CUSTOM_IO;
 for(auto p:{std::pair<const char*,const char*>{"protocol_whitelist","file"},{"format_whitelist","mov"},{"enable_drefs","0"},{"use_absolute_path","0"}})need(av_dict_set(&d.opts,p.first,p.second,0)==0,"option");
 need(avformat_open_input(&d.format,source.c_str(),av_find_input_format("mov"),&d.opts)>=0&&av_dict_count(d.opts)==0,"bounded local MOV open");
 need(d.format->pb==d.io&&(d.format->flags&AVFMT_FLAG_CUSTOM_IO),"source IO ownership");
 need(d.format->nb_streams<=8,"stream bound");int found=0,first=-1;int map[8];std::fill(std::begin(map),std::end(map),-1);
 for(unsigned n=0;n<d.format->nb_streams;n++){
  AVStream*s=d.format->streams[n];auto*c=s->codecpar;if(c->codec_type!=AVMEDIA_TYPE_AUDIO){s->discard=AVDISCARD_ALL;continue;}
  need(found<3&&s->id==found+2&&c->codec_id==AV_CODEC_ID_AAC&&c->sample_rate==48000&&c->ch_layout.nb_channels==2&&s->time_base.num==1&&s->time_base.den==48000,"qualified three-track AAC");need(s->start_time==0&&s->duration==sourceEnd&&c->initial_padding==0&&c->trailing_padding==0&&c->seek_preroll==0&&(c->ch_layout.order==AV_CHANNEL_ORDER_UNSPEC||(c->ch_layout.order==AV_CHANNEL_ORDER_NATIVE&&c->ch_layout.u.mask==AV_CH_LAYOUT_STEREO)),"source timeline/layout");if(first<0)first=n;map[n]=found++;
  need(c->extradata_size==2&&c->extradata[0]==0x11&&c->extradata[1]==0x90,"codecdata bound");
  Track t{s->id,c->initial_padding,c->trailing_padding,c->seek_preroll,c->frame_size,s->start_time,s->duration};t.extra.assign(c->extradata,c->extradata+c->extradata_size);t.packets.reserve(180);result.tracks.push_back(std::move(t));
 }
 need(found==3,"all3tracks");if(start>0)need(avformat_seek_file(d.format,first,INT64_MIN,start-2048,start-2048,0)>=0,"bounded seek");
 bool done[3]={false,false,false};size_t calls=0;d.packet=av_packet_alloc();need(d.packet,"packet allocation");
 while(!(done[0]&&done[1]&&done[2])){
  need(!Demux::interrupt(&d)&&++calls<=600,"read deadline/count");need(av_read_frame(d.format,d.packet)>=0,"premature read EOF/error");auto*p=d.packet;need(p->stream_index>=0&&p->stream_index<8,"packet stream");int t=map[p->stream_index];
  if(t<0||done[t]){av_packet_unref(p);continue;}
  need(aacrange::valid(p->pts,p->dts,p->duration,sourceEnd)&&p->size>0&&p->size<=65536&&result.packetBytes+p->size<=1048576,"packet bound/time");result.packetBytes+=p->size;
  auto&rows=result.tracks[t].packets;need(rows.size()<180&&p->side_data_elems<=1,"packet metadata bound");
  need(rows.empty()?p->pts+1024<=start:rows.back().pts+1024==p->pts,"required preroll/packet continuity");
  need((p->flags&~(AV_PKT_FLAG_KEY|AV_PKT_FLAG_DISCARD))==0&&(p->flags&AV_PKT_FLAG_KEY),"packet flags");
  need(!(p->flags&AV_PKT_FLAG_DISCARD)||p->pts+1024<=0,"unreviewed discard within media");Packet row{p->pts,p->dts,p->duration,p->flags};row.bytes.assign(p->data,p->data+p->size);
  for(int n=0;n<p->side_data_elems;n++){auto&v=p->side_data[n];need(v.type==AV_PKT_DATA_SKIP_SAMPLES&&v.size==10,"unsupported packet side data");Side sd{v.type,v.size};if(v.type==AV_PKT_DATA_SKIP_SAMPLES){need(v.size==10,"skip length");sd.head=AV_RL32(v.data);sd.tail=AV_RL32(v.data+4);sd.headReason=v.data[8];sd.tailReason=v.data[9];need(sd.headReason==0&&sd.tailReason==0&&sd.head==std::max(int64_t(0),-p->pts)&&sd.tail==std::max(int64_t(0),p->pts+1024-sourceEnd),"skip differs from edited source range");}row.side.push_back(sd);}
  rows.push_back(std::move(row));done[t]=p->pts+p->duration>=end;av_packet_unref(p);
 }
 need(!Demux::interrupt(&d),"late/cancelled input");d.close();need(result.closeAttempts==1&&result.closeStatus>=0&&result.sourceIOError>=0,"source IO close/read failure");result.seconds=now()-began;return result;
}
}
