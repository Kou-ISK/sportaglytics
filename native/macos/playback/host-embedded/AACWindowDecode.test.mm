#import "AACWindow.hpp"
#include <cstdio>
static unsigned disposed=0,filled=0;static int fault=0;static AudioStreamBasicDescription inDescription{},outDescription{};
static OSStatus fakeNew(const AudioStreamBasicDescription*in,const AudioStreamBasicDescription*out,AudioConverterRef*p){inDescription=*in;outDescription=*out;*p=reinterpret_cast<AudioConverterRef>(1);return noErr;}
static OSStatus fakeSet(AudioConverterRef,AudioConverterPropertyID,UInt32,const void*){return noErr;}
static OSStatus fakeGet(AudioConverterRef,AudioConverterPropertyID key,UInt32*size,void*out){
 if(key==kAudioConverterCurrentInputStreamDescription){auto a=inDescription;if(fault==1)a.mSampleRate=44100;memcpy(out,&a,sizeof(a));*size=sizeof(a);return noErr;}
 if(key==kAudioConverterCurrentOutputStreamDescription){auto a=outDescription;if(fault==2)a.mFormatFlags=kAudioFormatFlagIsSignedInteger|kAudioFormatFlagIsPacked;if(fault==3)a.mChannelsPerFrame=1;memcpy(out,&a,sizeof(a));*size=sizeof(a);return noErr;}
 if(key==kAudioConverterPrimeInfo){AudioConverterPrimeInfo p{};if(fault==4)p.leadingFrames=1024;memcpy(out,&p,sizeof(p));*size=sizeof(p);return noErr;}
 return -1;
}
static OSStatus fakeDispose(AudioConverterRef){disposed++;return noErr;}
static OSStatus fakeFill(AudioConverterRef,AudioConverterComplexInputDataProc callback,void*input,UInt32*count,AudioBufferList*buffers,AudioStreamPacketDescription*){
 filled++;if(fault==5){*count=0;buffers->mBuffers[0].mDataByteSize=0;return noErr;}
 if(fault==7){UInt32 n=1;AudioBufferList b{};AudioStreamPacketDescription*d=nullptr;OSStatus status=callback(reinterpret_cast<AudioConverterRef>(1),&n,&b,&d,input);require(status!=noErr&&n==0,@"callback copy failure distinct from EOF");return status;}
 if(fault==8||fault==9){*count=fault==8?1024:512;memset(buffers->mBuffers[0].mData,0,*count*8);buffers->mBuffers[0].mDataByteSize=*count*8;return noErr;}
 if(fault==6){nativeInterrupted=true;UInt32 n=1;AudioBufferList b{};AudioStreamPacketDescription*d=nullptr;OSStatus status=callback(reinterpret_cast<AudioConverterRef>(1),&n,&b,&d,input);require(status!=noErr&&n==0,@"callback cancellation distinct from EOF");return status;}
 return -1;
}
#define AudioConverterNew fakeNew
#define AudioConverterSetProperty fakeSet
#define AudioConverterGetProperty fakeGet
#define AudioConverterDispose fakeDispose
#define AudioConverterFillComplexBuffer fakeFill
#include "AACWindowDecode.mm"
#undef AudioConverterNew
#undef AudioConverterSetProperty
#undef AudioConverterGetProperty
#undef AudioConverterDispose
#undef AudioConverterFillComplexBuffer
static unsigned cases=0;
static void rejects(void(^body)(),NSString*expected){BOOL failed=NO;@try{body();}@catch(NSException*e){failed=[e.reason isEqual:expected];if(!failed)fprintf(stderr,"unexpected: %s\n",e.reason.UTF8String);}require(failed,@"negative case exact rejection");cases++;}
int main(){@autoreleasepool{@try{
 AudioStreamBasicDescription a{48000,kAudioFormatMPEG4AAC,0,0,1024,0,2,0,0};AudioChannelLayout layout{};layout.mChannelLayoutTag=kAudioChannelLayoutTag_Stereo;uint8_t cookie[2]={0x11,0x90};CMAudioFormatDescriptionRef f=nullptr;
 require(CMAudioFormatDescriptionCreate(kCFAllocatorDefault,&a,offsetof(AudioChannelLayout,mChannelDescriptions),&layout,sizeof(cookie),cookie,nullptr,&f)==noErr,@"fixture format");size_t n=0;const auto*l=CMAudioFormatDescriptionGetChannelLayout(f,&n);NSString*layoutHash=hashBytes(l,n);
 finiteaac::Track track{};track.packets.push_back({0,0,1024,1,std::vector<uint8_t>(8),{}});auto*trackPointer=&track;std::atomic<bool>cancel{false};auto*cancelPointer=&cancel;
 for(int mode=1;mode<=9;mode++){fault=mode;disposed=0;filled=0;nativeInterrupted=false;track.packets[0].bytes.resize(mode==7?0:8);NSString*reason=mode==1?@"AAC converter input changed":mode==2||mode==3?@"AAC converter output changed":mode==4?@"AAC unsupported converter priming":mode==5?@"AAC complete PCM window":mode==6?@"local PCM cancelled/deadline":mode==7?@"AAC converter output":@"AAC exact decoded packet length";
 rejects(^{localaac::decodeWindow(*trackPointer,f,0,0,1024,layoutHash,cancelPointer,mono()+5);},reason);require(disposed==1&&filled==(mode==8?2:mode>=5?1:0),@"disposal and no decode before format guards");}
 nativeInterrupted=false;fault=0;
 cancel=true;rejects(^{localaac::decodeWindow(*trackPointer,f,0,0,1024,layoutHash,cancelPointer,mono()+5);},@"local PCM cancelled/deadline");cancel=false;
 rejects(^{localaac::decodeWindow(*trackPointer,f,0,0,1024,layoutHash,cancelPointer,mono()-1);},@"local PCM cancelled/deadline");
 track.packets.resize(181);rejects(^{localaac::decodeWindow(*trackPointer,f,0,0,1024,layoutHash,cancelPointer,mono()+5);},@"AAC decode packet count");
 CFRelease(f);printf("{\"success\":true,\"cases\":%u,\"mediaRead\":false}\n",cases);return 0;
 }@catch(NSException*e){fprintf(stderr,"failed: %s\n",e.reason.UTF8String);return 1;}}}
