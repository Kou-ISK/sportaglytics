#import "NativeSupport.hpp"
#include <cerrno>
#include "PipeClosePolicy.hpp"
#include "OriginalFilterWindow.hpp"
#include "RawSocketOutput.hpp"
#include "OwnedProducerCPU.hpp"
#include <mach/mach_time.h>
struct Stamp{int64_t pts,duration;double metadataAt=0;};
static id cpuDifference(double start,double end){return start>=0&&end>=start&&std::isfinite(start)&&std::isfinite(end)?(id)@(end-start):(id)[NSNull null];}
static double threadSeconds(){timespec t{};if(clock_gettime(CLOCK_THREAD_CPUTIME_ID,&t)!=0)return -1;return t.tv_sec+t.tv_nsec/1e9;}
@implementation VideoFeed {
 NSDictionary*m_;diagnostic::Request token_;BOOL single_;dispatch_queue_t owner_;EventLog*log_;void(^frame_)(NSDictionary*);void(^done_)(NSDictionary*);NSTask*task_;CVPixelBufferPoolRef pool_;std::atomic<bool>cancel_;std::atomic<bool>ended_;std::atomic<int>pid_;
}
-(instancetype)initWithManifest:(NSDictionary*)m token:(diagnostic::Request)t single:(BOOL)s owner:(dispatch_queue_t)o log:(EventLog*)l frame:(void(^)(NSDictionary*))f done:(void(^)(NSDictionary*))d {if((self=[super init])){m_=m;token_=t;single_=s;owner_=o;log_=l;frame_=[f copy];done_=[d copy];pool_=nullptr;cancel_=false;ended_=false;pid_=0;}return self;}
-(BOOL)cancelled{return cancel_.load();}-(void)setCancelled:(BOOL)x{cancel_=x;}-(BOOL)ended{return ended_.load();}-(int)pid{return pid_.load();}
-(void)dealloc{if(pool_)CVPixelBufferPoolRelease(pool_);}
-(void)start{dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED,0),^{@autoreleasepool{[self run];}});}
-(void)run{
 double feedCPUStarted=threadSeconds();double started=mono(),rawCompleteAt=0,rawFirstAt=0,fieldPollWall=0;NSUInteger poolWaits=0,fieldReadCalls=0,fieldPollCalls=0,pollTimeouts=0,pollInterrupts=0,rawReadyPolls=0,metadataReadyPolls=0,rawReadBytes=0;double timeoutWall=0,rawDisabledWall=0,maxPollWall=0;NSMutableArray*benchmark=[NSMutableArray array];NSMutableArray*muxTrace=[NSMutableArray array];NSMutableArray*stages=[NSMutableArray array];NSMutableDictionary*report=[@{@"generation":@(token_.generation),@"target":@(token_.target),@"single":@(single_),@"success":@NO,@"completedRequestedRange":@NO} mutableCopy];int inFD=-1,outFD=-1,errFD=-1;NSPipe*raw=nil;NSPipe*meta=nil;NSPipe*control=nil;NSFileHandle*borrowedRawWriter=nil;diagnostic::RawSocketOutput socketRaw;bool useSocket=[m_[@"rawTransport"] isEqualToString:@"socketpair-256k"];bool q=false,rawEOF=false,metaEOF=false;size_t delivered=0,fill=0,rawBytes=0,metaBytes=0;bool failed=false;NSString*reason=nil;double cancelledAt=0;std::map<uint32_t,size_t>surfaceIDs;size_t surfaceBytes=0;
 NSMutableArray*cpuSamples=[NSMutableArray array];std::optional<diagnostic::OwnedProducerCPU>cpuObserver;mach_timebase_info_data_t cpuTimebase{};int cpuTimebaseStatus=0;
 [log_ add:@"producer-run-start" values:@{@"generation":@(token_.generation),@"monotonic":@(started)}];
 @try{
  NSDictionary*a=@{(id)kCVPixelBufferWidthKey:@1920,(id)kCVPixelBufferHeightKey:@1080,(id)kCVPixelBufferPixelFormatTypeKey:@(kCVPixelFormatType_420YpCbCr8BiPlanarVideoRange),(id)kCVPixelBufferIOSurfacePropertiesKey:@{}};
  require(CVPixelBufferPoolCreate(kCFAllocatorDefault,(__bridge CFDictionaryRef)@{(id)kCVPixelBufferPoolMinimumBufferCountKey:@32,(id)kCVPixelBufferPoolMaximumBufferAgeKey:@0},(__bridge CFDictionaryRef)a,&pool_)==0&&pool_,@"pool create");
  int64_t end=single_?token_.target+diagnostic::Step:[m_[@"videoEnd"] longLongValue];require(diagnostic::onGrid(end)&&end>token_.target,@"qualified video end");size_t count=(end-token_.target)/diagnostic::Step;
  int64_t priorInput=diagnostic::originalPrerollInputPTS(token_.target);
  NSString*filter=[NSString stringWithFormat:@"trim=start_pts=%lld,bwdif=mode=send_field:parity=auto:deint=all,trim=start_pts=%lld:end_pts=%lld,showinfo=checksum=0",(long long)priorInput,(long long)token_.target,(long long)end];
  // Progress text is unused and can interleave with showinfo color fragments.
  NSMutableArray*args=[@[@"-hide_banner",@"-nostats",@"-benchmark",@"-loglevel",@"level+info",@"-xerror",@"-threads",@"4",@"-copyts",@"-seek_timestamp",@"1",@"-ss",[NSString stringWithFormat:@"%.9f",(token_.target-2*diagnostic::Step)/(double)diagnostic::Scale],@"-noaccurate_seek",@"-t",@"10",@"-protocol_whitelist",@"file,pipe",@"-format_whitelist",@"mov",@"-f",@"mov",@"-enable_drefs",@"0",@"-use_absolute_path",@"0",@"-i",m_[@"source"],@"-map",@"0:v:0",@"-an",@"-sn",@"-dn",@"-filter_threads",@"1",@"-vf",filter,@"-c:v",@"rawvideo",@"-threads:v",@"1",@"-pix_fmt",@"yuv420p",@"-fps_mode:v",@"passthrough",@"-enc_time_base:v",@"1:120000",@"-frames:v",[NSString stringWithFormat:@"%zu",count],@"-avoid_negative_ts",@"disabled",@"-f",@"rawvideo",@"pipe:1"] mutableCopy];if([m_[@"traceMuxLatency"]boolValue])[args insertObject:@"-debug_ts" atIndex:1];
  if([m_[@"outputDirectIO"]boolValue])[args insertObjects:@[@"-avioflags",@"direct"] atIndexes:[NSIndexSet indexSetWithIndexesInRange:NSMakeRange(args.count-3,2)]];
  task_=[NSTask new];task_.executableURL=[NSURL fileURLWithPath:m_[@"ffmpeg"]];task_.arguments=args;meta=[NSPipe pipe];control=[NSPipe pipe];
  require(!m_[@"rawTransport"]||useSocket,@"unknown private raw transport");
  if(useSocket){
   try{socketRaw.open();}catch(const std::exception&e){require(false,[NSString stringWithUTF8String:e.what()]);}
   outFD=socketRaw.readerFD();borrowedRawWriter=[[NSFileHandle alloc]initWithFileDescriptor:socketRaw.writerFD() closeOnDealloc:NO];task_.standardOutput=borrowedRawWriter;
  }else{raw=[NSPipe pipe];outFD=raw.fileHandleForReading.fileDescriptor;task_.standardOutput=raw;}
  task_.standardError=meta;task_.standardInput=control;
  errFD=meta.fileHandleForReading.fileDescriptor;inFD=control.fileHandleForWriting.fileDescriptor;
  for(int fd:{outFD,errFD,inFD})require(fcntl(fd,F_SETFL,fcntl(fd,F_GETFL)|O_NONBLOCK)==0,@"nonblocking own pipe");
  require(fcntl(inFD,F_SETNOSIGPIPE,1)==0,@"own control pipe SIGPIPE protection");
  require(!cancel_&&!nativeInterrupted.load()&&self.launchDeadline>0&&mono()<self.launchDeadline,@"cancelled/late before launch");NSError*error=nil;require([task_ launchAndReturnError:&error],error.description?:@"producer launch");pid_=task_.processIdentifier;[log_ add:@"producer-launched" values:@{@"pid":@(pid_.load()),@"generation":@(token_.generation),@"arguments":args}];
  if([m_[@"observeProducerCPU"]boolValue]){cpuTimebaseStatus=mach_timebase_info(&cpuTimebase);if(cpuTimebaseStatus==KERN_SUCCESS&&cpuTimebase.denom)cpuObserver.emplace(pid_.load());}
  // NSPipe closes opposite ends on successful launch; the borrowed socket writer stays ours.
  if(useSocket)require(socketRaw.closeWriter(),@"raw socket writer close unknown");
  std::vector<unsigned char>bytes(3110400);std::string lines;std::map<size_t,Stamp>stamps;std::optional<std::pair<size_t,Stamp>>awaitColor;bool config=false;size_t outputIndex=0;
  while(!rawEOF||!metaEOF||task_.running){@autoreleasepool{
   if(nativeInterrupted.load())cancel_=true;
   if(cpuObserver){double queryBegan=mono();auto cpu=cpuObserver->sample(queryBegan,task_.running,cancel_.load());if(cpu){double queryEnded=mono();[cpuSamples addObject:@{@"at":@(queryBegan-started),@"queryWall":@(queryEnded-queryBegan),@"userMach":@(cpu->user),@"systemMach":@(cpu->system),@"processStartMach":@(cpu->processStart),@"workerCPU":cpuDifference(feedCPUStarted,threadSeconds()),@"delivered":@(delivered),@"rawBytes":@(rawBytes),@"fillBytes":@(fill),@"rawReadEnabled":@(!rawEOF&&fill<bytes.size())}];}}
   if(mono()-started>30&&!cancel_){failed=true;reason=@"producer wall deadline";cancel_=true;}
   if(cancel_&&!q){q=true;cancelledAt=mono();char c='q';ssize_t w=write(inFD,&c,1);[log_ add:@"producer-q" values:@{@"pid":@(pid_.load()),@"write":@(w)}];}
   if(q&&mono()-cancelledAt>10){[log_ add:@"producer-cleanup-pending" values:@{@"pid":@(pid_.load())}];cancelledAt=mono()+100000;failed=true;reason=reason?:@"producer cleanup unknown";}
   if(!cancel_&&fill==bytes.size()&&stamps.count(outputIndex)){
    require(config,@"missing source output clock config");auto stamp=stamps.at(outputIndex);require(stamp.pts==token_.target+(int64_t)outputIndex*diagnostic::Step&&stamp.duration==diagnostic::Step,@"actual output clock mismatch");
    CVPixelBufferRef pixel=nullptr;CVReturn cv=CVPixelBufferPoolCreatePixelBufferWithAuxAttributes(kCFAllocatorDefault,pool_,(__bridge CFDictionaryRef)@{(id)kCVPixelBufferPoolAllocationThresholdKey:@32},&pixel);
    if(cv==kCVReturnWouldExceedAllocationThreshold)poolWaits++;
    if(cv!=kCVReturnWouldExceedAllocationThreshold){require(cv==0&&pixel,@"surface allocation");
     @try{
      IOSurfaceRef io=CVPixelBufferGetIOSurface(pixel);require(io,@"IOSurface absent");auto inserted=surfaceIDs.emplace(IOSurfaceGetID(io),IOSurfaceGetAllocSize(io));if(inserted.second)surfaceBytes+=inserted.first->second;require(inserted.first->second==IOSurfaceGetAllocSize(io)&&IOSurfaceGetAllocSize(io)<=diagnostic::MaxSurfaceBytes/diagnostic::MaxSurfaces,@"pool ownership bound");
      double copyBegan=mono(),copyCPU=threadSeconds();require(CVPixelBufferLockBaseAddress(pixel,0)==0,@"surface copy lock");
      @try{require(CVPixelBufferGetWidth(pixel)==1920&&CVPixelBufferGetHeight(pixel)==1080&&CVPixelBufferGetPixelFormatType(pixel)==kCVPixelFormatType_420YpCbCr8BiPlanarVideoRange&&CVPixelBufferGetPlaneCount(pixel)==2,@"NV12 surface layout");require(CVPixelBufferGetWidthOfPlane(pixel,0)==1920&&CVPixelBufferGetHeightOfPlane(pixel,0)==1080&&CVPixelBufferGetWidthOfPlane(pixel,1)==960&&CVPixelBufferGetHeightOfPlane(pixel,1)==540,@"NV12 plane dimensions");
       auto*y=(unsigned char*)CVPixelBufferGetBaseAddressOfPlane(pixel,0);auto*uv=(unsigned char*)CVPixelBufferGetBaseAddressOfPlane(pixel,1);size_t ys=CVPixelBufferGetBytesPerRowOfPlane(pixel,0),us=CVPixelBufferGetBytesPerRowOfPlane(pixel,1);
       require(y&&uv&&ys>=1920&&ys<=4096&&us>=1920&&us<=4096,@"NV12 stride");
       for(size_t row=0;row<1080;row++)memcpy(y+row*ys,bytes.data()+row*1920,1920);
       for(size_t row=0;row<540;row++)for(size_t x=0;x<960;x++){uv[row*us+x*2]=bytes[2073600+row*960+x];uv[row*us+x*2+1]=bytes[2592000+row*960+x];}
      } @finally {require(CVPixelBufferUnlockBaseAddress(pixel,0)==0,@"surface copy unlock");}
      double copyEnded=mono(),copyCPUEnd=threadSeconds();
      CVBufferSetAttachments(pixel,(__bridge CFDictionaryRef)@{(id)kCVImageBufferColorPrimariesKey:(id)kCVImageBufferColorPrimaries_ITU_R_709_2,(id)kCVImageBufferTransferFunctionKey:(id)kCVImageBufferTransferFunction_ITU_R_709_2,(id)kCVImageBufferYCbCrMatrixKey:(id)kCVImageBufferYCbCrMatrix_ITU_R_709_2,(id)kCVImageBufferFieldCountKey:@1,(id)kCVImageBufferPixelAspectRatioKey:@{(id)kCVImageBufferPixelAspectRatioHorizontalSpacingKey:@1,(id)kCVImageBufferPixelAspectRatioVerticalSpacingKey:@1}},kCVAttachmentMode_ShouldPropagate);
      size_t index=(stamp.pts-diagnostic::First)/diagnostic::Step;require(index<diagnostic::Fields&&[m_[@"evidenceMode"] isEqualToString:@"original-observation-v1"],@"original observation scope");
      NSString*reference=m_[@"fieldReferences"][[NSString stringWithFormat:@"%lld",(long long)stamp.pts]];NSString*sha=nil;id hashWall=[NSNull null],hashCPUValue=[NSNull null];
      // Development reference samples only. Continuous playback must not hash every field.
      if(reference){double hashBegan=mono(),hashCPU=threadSeconds();sha=pixelHash(pixel);hashWall=@(mono()-hashBegan);hashCPUValue=cpuDifference(hashCPU,threadSeconds());require([sha isEqualToString:reference],@"saved local field reference mismatch");}
      [stages addObject:@{@"index":@(outputIndex),@"at":@(mono()-started),@"rawCompleteAt":@(rawCompleteAt-started),@"rawFirstAt":@(rawFirstAt-started),@"metadataAt":@(stamp.metadataAt-started),@"readyToCopyWall":@(copyBegan-MAX(rawCompleteAt,stamp.metadataAt)),@"rawReadCalls":@(fieldReadCalls),@"rawReadBytes":@(rawReadBytes),@"pollCalls":@(fieldPollCalls),@"pollWall":@(fieldPollWall),@"pollTimeouts":@(pollTimeouts),@"pollInterrupts":@(pollInterrupts),@"rawReadyPolls":@(rawReadyPolls),@"metadataReadyPolls":@(metadataReadyPolls),@"pollTimeoutWall":@(timeoutWall),@"rawDisabledPollWall":@(rawDisabledWall),@"maxPollWall":@(maxPollWall),@"copyWall":@(copyEnded-copyBegan),@"copyCPU":cpuDifference(copyCPU,copyCPUEnd),@"hashWall":hashWall,@"hashCPU":hashCPUValue,@"referenceCompared":@(reference!=nil)}];
      CMVideoFormatDescriptionRef fmt=nullptr;CMSampleBufferRef sample=nullptr;require(CMVideoFormatDescriptionCreateForImageBuffer(kCFAllocatorDefault,pixel,&fmt)==0,@"sample format");CMSampleTimingInfo timing={CMTimeMake(stamp.duration,120000),CMTimeMake(stamp.pts,120000),kCMTimeInvalid};OSStatus made=CMSampleBufferCreateReadyWithImageBuffer(kCFAllocatorDefault,pixel,fmt,&timing,&sample);CFRelease(fmt);require(made==0&&sample,@"timed sample");
      id object=CFBridgingRelease(sample);NSDictionary*frame=@{@"sample":object,@"generation":@(token_.generation),@"session":@(token_.session),@"pts":@(stamp.pts),@"index":@(index),@"sha":sha?:[NSNull null],@"sourceTimingValidated":@YES,@"referenceCompared":@(reference!=nil),@"created":@(mono()),@"surfaceID":@(IOSurfaceGetID(io)),@"surfaceBytes":@(IOSurfaceGetAllocSize(io))};dispatch_async(owner_,^{frame_(frame);});delivered++;fill=0;fieldReadCalls=fieldPollCalls=pollTimeouts=pollInterrupts=rawReadyPolls=metadataReadyPolls=rawReadBytes=0;fieldPollWall=timeoutWall=rawDisabledWall=maxPollWall=0;stamps.erase(outputIndex++);
     }@finally{CVPixelBufferRelease(pixel);}
    }
   }
   pollfd fd[2]={{rawEOF?-1:outFD,(short)((cancel_||fill<bytes.size())?POLLIN:0),0},{metaEOF?-1:errFD,POLLIN,0}};double pollBegan=mono();int ready=poll(fd,2,10);int pollError=errno;double pollElapsed=mono()-pollBegan;fieldPollWall+=pollElapsed;fieldPollCalls++;maxPollWall=std::max(maxPollWall,pollElapsed);if(!fd[0].events)rawDisabledWall+=pollElapsed;if(ready==0){pollTimeouts++;timeoutWall+=pollElapsed;}if(ready>0){if(fd[0].revents)rawReadyPolls++;if(fd[1].revents)metadataReadyPolls++;}if(ready<0){if(pollError==EINTR){pollInterrupts++;continue;}require(false,@"producer pipe poll");}
   if(!rawEOF&&(cancel_||fill<bytes.size())&&fd[0].revents){fieldReadCalls++;ssize_t n=read(outFD,bytes.data()+(cancel_?0:fill),cancel_?bytes.size():bytes.size()-fill);if(n==0)rawEOF=true;else if(n>0){rawBytes+=n;if(!cancel_){if(fill==0)rawFirstAt=mono();fill+=n;rawReadBytes+=n;if(fill==bytes.size())rawCompleteAt=mono();}}else require(errno==EAGAIN||errno==EINTR,@"raw read");}
   if(!metaEOF&&fd[1].revents){char b[16384];ssize_t n=read(errFD,b,sizeof(b));if(n==0)metaEOF=true;else if(n>0){metaBytes+=n;require(metaBytes<=4*1024*1024,@"metadata limit");lines.append(b,n);size_t at;
     while((at=lines.find('\n'))!=std::string::npos){std::string line=lines.substr(0,at);lines.erase(0,at+1);if(line.find("bench:")!=std::string::npos){require(benchmark.count<4,@"benchmark output bound");[benchmark addObject:[NSString stringWithUTF8String:line.c_str()]];}if([m_[@"traceMuxLatency"]boolValue]&&line.find("muxer <- pts:")!=std::string::npos){require(muxTrace.count<diagnostic::Fields,@"mux trace bound");[muxTrace addObject:@{@"received":@(mono()-started),@"line":[NSString stringWithUTF8String:line.c_str()]}];}if(cancel_)continue;if(line.find("config in time_base: 1/120000, frame_rate: 120000/1001")!=std::string::npos)config=true;
      auto loc=line.find(" n:");if(line.find("Parsed_showinfo_3")!=std::string::npos&&loc!=std::string::npos){long long n0,p0,d0;require(sscanf(line.c_str()+loc," n: %lld pts: %lld",&n0,&p0)==2,@"frame metadata parse");auto dur=line.find(" duration:");require(dur!=std::string::npos&&sscanf(line.c_str()+dur," duration: %lld",&d0)==1,@"duration metadata");require(line.find("fmt:yuv420p")!=std::string::npos&&line.find("sar:1/1")!=std::string::npos&&line.find("s:1920x1080")!=std::string::npos&&line.find("i:P")!=std::string::npos&&!awaitColor,@"field metadata format");awaitColor=std::make_pair((size_t)n0,Stamp{p0,d0});}
      if(line.find("color_range:")!=std::string::npos&&awaitColor){require(line.find("color_range:tv color_space:bt709 color_primaries:bt709 color_trc:bt709")!=std::string::npos,[@"field color: " stringByAppendingString:[NSString stringWithUTF8String:line.c_str()]]);require(!stamps.count(awaitColor->first),@"duplicate field stamp");awaitColor->second.metadataAt=mono();stamps.insert(*awaitColor);awaitColor.reset();require(stamps.size()<=64,@"metadata queue bound");}
      require(line.find("[error]")==std::string::npos&&line.find("[fatal]")==std::string::npos,@"decoder error log");
     }require(lines.size()<=16384,@"metadata line bound");
    }else require(errno==EAGAIN||errno==EINTR,@"metadata read");}
   if(rawEOF&&!cancel_)require(fill==0,@"raw partial EOF");
  }}
  require(!task_.running,@"producer exit unknown");report[@"exit"]=@(task_.terminationStatus);report[@"rawEOF"]=@(rawEOF);report[@"metadataEOF"]=@(metaEOF);if(!cancel_)require(task_.terminationStatus==0&&delivered==count&&rawBytes==count*3110400&&stamps.empty()&&!awaitColor,@"producer final count/exit");report[@"success"]=@(!failed);if(!cancel_)report[@"completedRequestedRange"]=@YES;
 }@catch(NSException*e){failed=true;reason=e.reason;cancel_=true;[log_ add:@"producer-failure-detected" values:@{@"generation":@(token_.generation),@"pid":@(pid_.load()),@"reason":reason?:@"unknown",@"completedFields":@(delivered)}];
  if(task_&&task_.running){if(inFD>=0&&!q){char c='q';write(inFD,&c,1);q=true;} // Keep ownership and drain both pipes until actual exit, never kill.
   while(task_.running){char b[65536];for(int fd:{outFD,errFD})if(fd>=0)while(read(fd,b,sizeof(b))>0){}poll(nullptr,0,10);}
  }
 }@finally{
  report[@"success"]=@(!failed);report[@"failure"]=reason?:[NSNull null];report[@"cancelled"]=@(cancel_.load());report[@"fields"]=@(delivered);report[@"pid"]=@(pid_.load());report[@"seconds"]=@(mono()-started);report[@"stageTimings"]=stages;report[@"ffmpegBenchmark"]=benchmark;report[@"muxTrace"]=muxTrace;report[@"muxTraceScope"]=@"FFmpeg pre-write stage latency plus consumer stderr receipt; neither is raw write duration";report[@"threadCPUSeconds"]=cpuDifference(feedCPUStarted,threadSeconds());report[@"workerStartedMonotonic"]=@(started);report[@"timingScope"]=@"consumer timestamps include pipe, scheduling and pool waits; benchmark includes producer cancellation/drain";report[@"poolWaits"]=@(poolWaits);report[@"distinctSurfaceIDs"]=@(surfaceIDs.size());report[@"cumulativeAllocationBytes"]=@(surfaceBytes);report[@"poolAllocationThreshold"]=@(diagnostic::MaxSurfaces);report[@"poolMaximumBufferAge"]=@0;report[@"actualExitKnown"]=@(!task_||!task_.running);if(task_&&!task_.running&&pid_>0)report[@"exit"]=@(task_.terminationStatus);
  report[@"producerCPU"]=@{@"enabled":@([m_[@"observeProducerCPU"]boolValue]),@"samples":cpuSamples,@"attempts":@(cpuObserver?cpuObserver->attempts():0),@"error":@(cpuObserver?cpuObserver->error():0),@"status":cpuObserver?[NSString stringWithUTF8String:cpuObserver->reason()]:@"not enabled/timebase unavailable",@"timebaseStatus":@(cpuTimebaseStatus),@"timebaseNumer":@(cpuTimebase.numer),@"timebaseDenom":@(cpuTimebase.denom),@"scope":@"owned live producer CPU only, opportunistic <=10Hz, Mach absolute units; low CPU does not distinguish blocking from descheduling"};
  diagnostic::PipeCloseLedger closeLedger;
  NSArray*handles=@[raw.fileHandleForReading?:[NSNull null],meta.fileHandleForReading?:[NSNull null],control.fileHandleForWriting?:[NSNull null]];
  for(NSUInteger i=0;i<handles.count;i++){if(handles[i]==[NSNull null])continue;closeLedger.own(i);@try{[(NSFileHandle*)handles[i] closeFile];closeLedger.closed(i);}@catch(NSException*e){closeLedger.unknown(i);report[@"success"]=@NO;report[@"closeError"]=e.reason;}}
  // Before a successful launch, the opposite NSPipe endpoints remain ours too.
  diagnostic::PipeCloseLedger unlaunchedLedger;
  if(pid_==0){NSArray*unused=@[raw.fileHandleForWriting?:[NSNull null],meta.fileHandleForWriting?:[NSNull null],control.fileHandleForReading?:[NSNull null]];for(NSUInteger i=0;i<unused.count;i++){if(unused[i]==[NSNull null])continue;unlaunchedLedger.own(i);@try{[(NSFileHandle*)unused[i]closeFile];unlaunchedLedger.closed(i);}@catch(NSException*e){unlaunchedLedger.unknown(i);report[@"success"]=@NO;report[@"closeError"]=e.reason;}}}
  socketRaw.closeWriter();socketRaw.closeReader(); // One-attempt ledger never retries an uncertain close.
  report[@"outputDirectIO"]=@([m_[@"outputDirectIO"]boolValue]);report[@"rawTransport"]=useSocket?@"socketpair-256k":@"NSPipe";report[@"rawSocketBuffers"]=@{@"send":@(socketRaw.sendBytes()),@"receive":@(socketRaw.receiveBytes())};report[@"rawSocketCloseConfirmed"]=@(socketRaw.confirmed());report[@"rawSocketCloseErrors"]=@{@"writer":@(socketRaw.writerCloseError()),@"reader":@(socketRaw.readerCloseError())};
  bool closeConfirmed=closeLedger.confirmed()&&unlaunchedLedger.confirmed()&&socketRaw.confirmed();report[@"pipeCloseConfirmed"]=@(closeConfirmed);
  if(!closeConfirmed){report[@"success"]=@NO;}
  if(!closeConfirmed){[log_ add:@"producer-pipe-close-unknown" values:report];while(true)[NSThread sleepForTimeInterval:.1];} // Ownership retained; never retry uncertain close or report ended.
 
  ended_=true;[log_ add:@"producer-finished" values:report];dispatch_async(owner_,^{done_(report);});
 }
}
@end
