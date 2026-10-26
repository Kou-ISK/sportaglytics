#import "NativeSupport.hpp"
#include "../recurrence/Recorder.hpp"
#import "../direct-frame-handoff/DirectVideoFeed.hpp"
#import "../direct-frame-handoff/DeferredFieldImage.hpp"
#import "VideoWorkerCompletion.hpp"
#include "../surface-transport/SurfaceSender.hpp"
#include "FinalizationPolicy.hpp"
#include "PCMWindowPolicy.hpp"
#import "PCMWindowSupply.hpp"
#include "StableAudioReady.hpp"
#include "RendererPreparation.hpp"
#include "ImageAvailability.hpp"
#include "BufferedSeekFrames.hpp"
#include "BufferedSeekFailure.hpp"
#include "PrerollReserve.hpp"
#include "ProductPreroll.hpp"
#include "StartDeadline.hpp"
#include "ProductClockPolicy.hpp"
#include "ProductControls.hpp"
#include "NativeClockControl.hpp"
#include "MetricSnapshotPolicy.hpp"
#import <CoreAudio/CoreAudio.h>
#include <csignal>
#include <sys/stat.h>
#include <cerrno>
#include <memory>
#include "../SourcePosition.hpp"
static NSMutableArray<NSDictionary*>*ownerCommands;
static std::string ownerInput;
static bool ownerClose=false;
static void pollOwnerCancellation(){
 char bytes[4096];ssize_t count=read(STDIN_FILENO,bytes,sizeof(bytes));
 if(count==0||(count<0&&errno!=EAGAIN&&errno!=EINTR)){nativeInterrupted.store(true);return;}
 if(count<=0)return;ownerInput.append(bytes,count);if(ownerInput.size()>8192){nativeInterrupted.store(true);return;}
 size_t at;while((at=ownerInput.find('\n'))!=std::string::npos){std::string line=ownerInput.substr(0,at);ownerInput.erase(0,at+1);
  if(line=="q"){ownerClose=true;continue;}
  NSData*d=[NSData dataWithBytes:line.data() length:line.size()];id value=[NSJSONSerialization JSONObjectWithData:d options:0 error:nil];
  if(![value isKindOfClass:[NSDictionary class]]||ownerCommands.count>=16){nativeInterrupted.store(true);return;}[ownerCommands addObject:value];
 }
}
static void noteSignal(int){nativeInterrupted.store(true,std::memory_order_relaxed);}
static int finalExit=2;
@interface DisplayDiagnostic:NSObject<NSApplicationDelegate,NSWindowDelegate>
-(instancetype)initWithManifest:(NSDictionary*)manifest result:(NSString*)result automatic:(BOOL)automatic;
@end
@implementation DisplayDiagnostic {
 BOOL bufferedPreparing_;NSUInteger deferredImageCount_;double deferredImageSeconds_;uint64_t maximumQueuedDecodedBytes_;
 nativeplayback::SourcePosition targetPosition_;std::unique_ptr<nativeplayback::AudioTimeline> audioTimeline_;id playbackActivity_;SurfaceSender surfaces_;NSMutableArray*surfaceFrames_;uint64_t sentGeneration_;int64_t sentPTS_;
 uint64_t playInterval_,metricsSequence_;BOOL metricsStartReady_;
 diagnostic::ProductStopAck productStop_;diagnostic::ProductStartAck productStart_;uint64_t startupBelowVideo_,startupBelowAudio_,clockCommandID_,startTraceCount_,startSequence_,startSeek_;BOOL startupClockRecorded_,hasConfirmedProductTime_;double confirmedProductTime_,productPlayPendingAt_;NSDictionary*intent_;NSDictionary*stoppedClock_;BOOL mediaRecoveryPending_;uint64_t observationRevision_;double nextObservation_;BOOL productReady_,productPlayPending_,productPlayStarted_;NSUInteger protocolWrites_;dispatch_queue_t protocolQueue_;
 NSDictionary*m_;NSString*resultPath_;BOOL automatic_;EventLog*log_;NSWindow*window_;NSTextField*label_;AVSampleBufferAudioRenderer*audio_;AVSampleBufferRenderSynchronizer*sync_;PCMWindowSupply*pcm_;int64_t audioNextSample_;id<ProductVideoFeed>feed_;NSMutableArray*frames_;dispatch_source_t tick_;diagnostic::Policy policy_;diagnostic::RendererPreparation preparation_;diagnostic::ImageAvailability imageAvailability_;double nextPrerollLog_;diagnostic::StartAckDeadline metricsStart_;BOOL emptyConfirmed_;NSString*activeSourceSHA_;diagnostic::Request active_;std::atomic<bool>cancelPrepare_;BOOL started_,closing_,finished_,pending_,flushPending_,audioBarrier_,feedKnown_,single_,scrubbing_,clockAck_,frameAck_,audioAck_,baseline_,baselineEnded_;BOOL videoFlushConfirmed_,enqueuedActive_;double startWall_,requestWall_,phaseWall_,playWall_,nextMetrics_;int switchStage_,seekStage_,scrubCount_;unsigned track_;NSUInteger audioIndex_;int64_t target_,videoEnd_,audioEnd_;NSString*phase_;NSString*failure_;id audioNotice_;NSMutableArray*metrics_;NSDictionary*baselineMetrics_;double videoGapStart_,audioGapStart_;BOOL videoCoverageGapOpen_;NSUInteger gaps_;int64_t lastDisplayed_;uint64_t audioEpoch_;double stopWall_;BOOL audioRemoved_;uint64_t pollCount_;BOOL preparing_,cleanupUncertain_,readinessSnapshotFailed_;NSUInteger pendingMetrics_,videoEnqueues_,lateVideoEnqueues_;double activeRequestWall_;std::map<uint64_t,double>requestTimes_;NSDictionary*continuousProof_;double playRequestWall_;BOOL finalizing_;double finalStageWall_;int finalStage_;int64_t audioStart_;double scrubStartWall_;dispatch_time_t scrubScheduleStart_;BOOL audioCoverageValid_;BOOL audioHeadEditResolved_;uint64_t audioRequestEpoch_;unsigned audioRequestTrack_;int64_t audioRequestTarget_;BOOL progressPending_;double progressAt_,nextProgress_;diagnostic::Finalization finalization_;diagnostic::StableAudioReady audioReady_;NSMutableArray*cadence_;uint64_t cadenceCount_;double nextAudioState_;double priorDisplayStamp_,minDisplayPeriod_,maxDisplayPeriod_;
}
-(instancetype)initWithManifest:(NSDictionary*)m result:(NSString*)path automatic:(BOOL)a{if((self=[super init])){m_=m;resultPath_=path;protocolQueue_=dispatch_queue_create("native-product-protocol",DISPATCH_QUEUE_SERIAL);automatic_=a;log_=[[EventLog alloc]initWithRolling:[m[@"rollingPCM"]boolValue] recordDetails:![m[@"packagedRuntime"]boolValue]];frames_=[NSMutableArray array];surfaceFrames_=[NSMutableArray array];metrics_=[NSMutableArray array];cadence_=[NSMutableArray array];phase_=@"prepared";cancelPrepare_=false;target_=[m[@"fieldFirst"]longLongValue];targetPosition_={target_,120000,target_};lastDisplayed_=-1;feedKnown_=YES;}return self;}
-(void)applicationDidFinishLaunching:(NSNotification*)note{
  tick_=dispatch_source_create(DISPATCH_SOURCE_TYPE_TIMER,0,0,dispatch_get_main_queue());dispatch_source_set_timer(tick_,dispatch_time(DISPATCH_TIME_NOW,0),5*NSEC_PER_MSEC,NSEC_PER_MSEC);dispatch_source_set_event_handler(tick_,^{@try{[self tick];}@catch(NSException*e){[self fail:e.reason];}});dispatch_resume(tick_);
 @try{
  try{surfaces_.open([m_[@"surfaceService"] UTF8String],[m_[@"surfaceOwnerPID"] intValue]);}catch(const std::exception&e){require(false,[NSString stringWithUTF8String:e.what()]);}
  if([m_[@"packagedRuntime"]boolValue])require([m_[@"videoExecution"]isEqualToString:@"in-process-avframe"]&&[m_[@"rollingPCM"]boolValue]&&[m_[@"deferredImages"]boolValue]&&[m_[@"fieldReferences"]isKindOfClass:[NSDictionary class]]&&[m_[@"fieldReferences"]count]==0,@"invalid packaged runtime profile");
  pollOwnerCancellation();require([m_[@"evidenceMode"]isEqualToString:@"original-observation-v1"]&&[m_[@"fieldStep"]longLongValue]==diagnostic::Step&&[m_[@"timeScale"]longLongValue]==diagnostic::Scale,@"source clock profile mismatch");try{audioTimeline_=std::make_unique<nativeplayback::AudioTimeline>([m_[@"pcmStart"]longLongValue],[m_[@"pcmEnd"]longLongValue]);policy_.configure(nativeplayback::FieldTimeline([m_[@"fieldFirst"]longLongValue],[m_[@"videoEnd"]longLongValue]));}catch(const std::exception&e){require(false,[NSString stringWithUTF8String:e.what()]);}require(!nativeInterrupted.load(),@"cancelled before diagnostic window");window_=[[NSWindow alloc]initWithContentRect:NSMakeRect(140,140,1020,650) styleMask:NSWindowStyleMaskTitled|NSWindowStyleMaskClosable backing:NSBackingStoreBuffered defer:NO];window_.title=@"SporTagLytics Product Native Check";window_.delegate=self;window_.releasedWhenClosed=NO;
  NSView*view=window_.contentView;sync_=[AVSampleBufferRenderSynchronizer new];sync_.delaysRateChangeUntilHasSufficientMediaData=YES;audio_=[AVSampleBufferAudioRenderer new];audio_.volume=.1;audio_.muted=YES;[sync_ addRenderer:audio_];[self setClockRate:0 time:CMTimeMake(targetPosition_.value,targetPosition_.scale) host:kCMTimeInvalid reason:@"initial-anchor"];
  label_=[NSTextField labelWithString:@"準備中 — 自動診断の操作は物理scrub検証ではありません"];label_.frame=NSMakeRect(20,35,840,28);[view addSubview:label_];NSButton*stop=[NSButton buttonWithTitle:@"診断を停止" target:self action:@selector(userStop:)];stop.frame=NSMakeRect(885,28,115,32);[view addSubview:stop];
  [window_ orderOut:nil];NSScreen*screen=NSScreen.mainScreen;
  [log_ add:@"prepared" values:@{@"pid":@((int)getpid()),@"automatic":@(automatic_),@"sourceFrameRate":@(120000.0/1001),@"screenMaximumFramesPerSecond":@(screen.maximumFramesPerSecond),@"windowVisible":@(window_.visible),@"occlusionVisible":@((window_.occlusionState&NSWindowOcclusionStateVisible)!=0),@"privateProductUnchanged":@YES}];
  audioNotice_=[[NSNotificationCenter defaultCenter]addObserverForName:AVSampleBufferAudioRendererWasFlushedAutomaticallyNotification object:nil queue:[NSOperationQueue mainQueue] usingBlock:^(NSNotification*n){if(n.object==audio_&&!closing_){audioAck_=NO;audioCoverageValid_=NO;audioEnd_=0;[self fail:@"audio renderer automatically flushed"];}}];


  label_.stringValue=@"製品controller接続待機 — 通常UIは未有効";
 }@catch(NSException*e){[self fail:e.reason];}
}
-(void)pollSurfaces{try{surfaces_.poll();}catch(const std::exception&e){require(false,[NSString stringWithUTF8String:e.what()]);}}
-(void)sendSurface{
 if(closing_||bufferedPreparing_||!active_.generation||pending_||flushPending_||!intent_)return;
 if(sentGeneration_==active_.generation&&!surfaces_.demanded())return;
 CMTime presentationClock=sync_.currentTime;if(!CMTIME_IS_NUMERIC(presentationClock)||presentationClock.timescale<=0)return;
 double now=CMTimeGetSeconds(presentationClock)*120000;
 NSInteger chosen=-1;for(NSUInteger i=0;i<surfaceFrames_.count;i++){
  NSDictionary*f=surfaceFrames_[i];const int64_t pts=[f[@"pts"]longLongValue];
  if([f[@"generation"]unsignedLongLongValue]!=active_.generation||(!frameAck_&&pts!=active_.target))continue;
  if(nativeplayback::fieldDue(pts,presentationClock.value,presentationClock.timescale))chosen=i;
 }
 if(chosen<0)return;NSDictionary*f=surfaceFrames_[chosen];int64_t pts=[f[@"pts"]longLongValue];
 if(sentGeneration_==active_.generation&&sentPTS_==pts)return;
 // This method and protocol reservation run on the same serial owner queue.
 // Prepare the notice and reserve capacity before creating a Mach obligation.
 if(protocolWrites_>=4||!surfacewire::hasFrameCredit(surfaces_.pending()))return;
 NSData*notice=[NSJSONSerialization dataWithJSONObject:@{@"type":@"surface-ready",@"generation":m_[@"owner"][@"generation"],@"id":@(surfaces_.nextID())} options:0 error:nil];
 require(notice&&notice.length<4096,@"surface notice serialization");
 CMSampleBufferRef sample=(__bridge CMSampleBufferRef)f[@"sample"];
 try{
  if(!sample){
   DeferredFieldImage*image=f[@"image"];require([image isKindOfClass:DeferredFieldImage.class]&&image.decodedReady,@"missing decoded field");BOOL alreadyPrepared=image.prepared;double began=mono();recurrence::note(1,32,active_.generation,[intent_[@"seekId"]unsignedLongLongValue],pts);sample=[image prepareSample];recurrence::note(1,sample?33:34,active_.generation,[intent_[@"seekId"]unsignedLongLongValue],pts);
   if(!sample)return; // Retain candidate and demand; poll/release continues next tick.
   if(!alreadyPrepared){double seconds=mono()-began;deferredImageCount_++;deferredImageSeconds_+=seconds;[log_ add:@"deferred-image-prepared" values:@{@"generation":@(active_.generation),@"pts":@(pts),@"seconds":@(seconds)}];}
  }
  recurrence::note(1,35,active_.generation,[intent_[@"seekId"]unsignedLongLongValue],pts,surfaces_.nextID());
  if(!surfaces_.send(sample,active_.generation,[intent_[@"seekId"]unsignedLongLongValue],pts))return;}catch(const std::exception&e){require(false,[NSString stringWithUTF8String:e.what()]);}
 [self enqueueProductPacket:notice];
 recurrence::note(1,36,active_.generation,[intent_[@"seekId"]unsignedLongLongValue],pts,surfaces_.nextID()-1);surfaces_.consumedDemand();sentGeneration_=active_.generation;sentPTS_=pts;[surfaceFrames_ removeObjectsInRange:NSMakeRange(0,chosen+1)];
 [log_ add:@"surface-sent" values:@{@"generation":@(active_.generation),@"seekId":intent_[@"seekId"],@"pts":@(pts),@"clockTicks":@(now),@"presentationClock":timeJSON(presentationClock),@"retained":@(surfaces_.pending())}];
}
-(void)userStart:(id)sender{[self begin:@"AppKit-Start-action"];}
-(void)userStop:(id)sender{[self fail:@"user requested diagnostic stop"];}
-(BOOL)windowShouldClose:(NSWindow*)sender{[self fail:@"user closed diagnostic"];return NO;}
-(NSApplicationTerminateReply)applicationShouldTerminate:(NSApplication*)sender{[self fail:@"application quit requested"];return NSTerminateCancel;}
-(void)begin:(NSString*)method{
 pollOwnerCancellation();if(nativeInterrupted.load()){[self fail:@"cancelled before begin"];return;}if(started_||closing_)return;playbackActivity_=[NSProcessInfo.processInfo beginActivityWithOptions:NSActivityUserInitiatedAllowingIdleSystemSleep reason:@"User-requested bounded playback diagnostic"];[log_ add:@"playback-activity-begin" values:@{@"idleSystemSleepAllowed":@YES,@"idleDisplaySleepAllowed":@YES}];started_=YES;startWall_=mono();phase_=@"preparing-audio";[log_ add:@"started" values:@{@"method":method,@"physicalScrubVerified":@NO}];label_.stringValue=@"必要な音声範囲を準備中";
 pcm_=[[PCMWindowSupply alloc]initWithManifest:m_ log:log_ ready:^(NSString*error){@try{if(error){[self fail:error];return;}if(!closing_)[self issueIfReady];}@catch(NSException*e){[self fail:e.reason];}}];[self issueProductSeek];
}
-(BOOL)stoppedAt:(int64_t)pts{
 CMTime raw;Float64 rate=1;OSStatus r=CMTimebaseGetTimeAndRate(sync_.timebase,&raw,&rate);return pts==target_&&pts==targetPosition_.field&&r==0&&rate==0&&equalTime(raw,targetPosition_.value,targetPosition_.scale);
}
-(void)request:(int64_t)pts track:(unsigned)t single:(BOOL)single phase:(NSString*)phase{
 require(!closing_,@"request during close");auto request=policy_.request(pts,t);requestWall_=[phase isEqualToString:@"initial-stopped"]?startWall_:mono();requestTimes_.clear();requestTimes_[request.generation]=requestWall_;single_=single;phase_=phase;pending_=YES;BOOL keepFeed=scrubbing_&&feed_&&!frameAck_&&policy_.mayPresent(active_);if(!keepFeed){target_=request.target;track_=t;[self setClockRate:0 time:CMTimeMake(targetPosition_.value,targetPosition_.scale) host:kCMTimeInvalid reason:@"seek-anchor"];}
 [log_ add:@"target-requested" values:@{@"generation":@(request.generation),@"session":@(request.session),@"target":@(request.target),@"requestedClock":timeJSON(CMTimeMake(targetPosition_.value,targetPosition_.scale)),@"track":@(t),@"phase":phase,@"programmatic":@YES}];
 // During scrub, finish the one active bounded target; pending remains one latest slot.
 if(feed_&&!feed_.ended&&!(scrubbing_&&single_&&policy_.mayPresent(active_)))feed_.cancelled=YES;
 [self transition];
}
-(void)transition{
 [surfaceFrames_ removeAllObjects];
 if(closing_||!pending_||pendingMetrics_||preparation_.pending()||flushPending_||audioBarrier_||!feedKnown_||(feed_&&!feed_.ended))return;
 if(scrubbing_&&feed_&&!frameAck_&&policy_.mayPresent(active_))return;
 auto desired=policy_.desired();if(!desired)return;if(target_!=desired->target){target_=desired->target;track_=desired->track;[self setClockRate:0 time:CMTimeMake(targetPosition_.value,targetPosition_.scale) host:kCMTimeInvalid reason:@"retarget-anchor"];return;}
 if(![self stoppedAt:target_])return;
 // Previous worker is confirmed closed above. Imported surfaces remain owned by
 // SurfaceSender until GPU release; they cannot be reused by this new generation.
 uint64_t preparing=preparation_.begin();imageAvailability_.cancel();enqueuedActive_=NO;
 [frames_ removeAllObjects];feed_=nil;emptyConfirmed_=YES;videoFlushConfirmed_=YES;
 require(preparation_.videoReady(preparing),@"surface preparation generation");
 [log_ add:@"surface-queue-prepared" values:@{@"preparation":@(preparing),@"priorWorkerClosed":@YES,@"retainedTransfers":@(surfaces_.pending()),@"previousCanvasImageRetained":@YES}];
 [self replaceAudio:0];
}
-(void)replaceAudio:(int)unused{
 if(audioBarrier_||closing_)return;audioBarrier_=YES;audioAck_=NO;audioCoverageValid_=NO;audioEnd_=0;audioIndex_=0;audioHeadEditResolved_=NO;AVSampleBufferAudioRenderer*old=audio_;float savedVolume=old.volume;BOOL savedMuted=old.muted;uint64_t epoch=++audioEpoch_;uint64_t preparing=preparation_.pending()?preparation_.generation():0;
 [sync_ removeRenderer:old atTime:kCMTimeInvalid completionHandler:^(BOOL didRemove){dispatch_async(dispatch_get_main_queue(),^{
  @try{if(epoch!=audioEpoch_){[self fail:@"late audio removal generation"];return;}require(didRemove,@"audio removal not confirmed");[old stopRequestingMediaData];[old flush];audio_=nil;
   if(closing_){audioBarrier_=NO;audioRemoved_=YES;return;}
   audioRequestEpoch_=epoch;audioRequestTrack_=track_;audioRequestTarget_=target_;audio_=[AVSampleBufferAudioRenderer new];audio_.volume=savedVolume;audio_.muted=savedMuted;[sync_ addRenderer:audio_];[self setClockRate:0 time:CMTimeMake(targetPosition_.value,targetPosition_.scale) host:kCMTimeInvalid reason:@"audio-renderer-attached"];audioBarrier_=NO;if(preparing)require(preparation_.audioReady(preparing),@"audio preparation generation");audioCoverageValid_=NO;[log_ add:@"audio-replaced" values:@{@"track":@(track_),@"target":@(target_),@"epoch":@(epoch),@"oldRemoved":@YES,@"preservedVolume":@(savedVolume),@"preservedMuted":@(savedMuted)}];[self issueIfReady];
  }@catch(NSException*e){[self fail:e.reason];}
 });}];
}
-(void)issueIfReady{
 if(bufferedPreparing_){
  if(closing_||pending_||audioBarrier_||flushPending_||![self stoppedAt:target_]||![pcm_ covers:target_*2/5])return;
  require(imageAvailability_.begin(active_,emptyConfirmed_,[self stoppedAt:active_.target]),@"buffered image generation setup");bufferedPreparing_=NO;return;
 }
 pollOwnerCancellation();if(nativeInterrupted.load()){[self fail:@"cancelled before feed issue"];return;}
 if(closing_||!pending_||![pcm_ covers:target_*2/5]||!preparation_.ready()||flushPending_||audioBarrier_||!videoFlushConfirmed_||![self stoppedAt:target_])return;
 auto desired=policy_.desired();if(!desired||desired->target!=target_||desired->track!=track_)return;require(audioIndex_==0&&!audioHeadEditResolved_,@"prepared audio renderer already fed");auto bound=preparation_.bindLatest(*desired,target_,[self stoppedAt:target_],audioIndex_==0&&!audioHeadEditResolved_);require(bound.has_value(),@"renderer preparation could not bind latest");require(mono()-requestWall_<5&&([m_[@"rollingPCM"]boolValue]||mono()-startWall_<90),@"late media worker issue");auto issued=policy_.issue();require(issued&&diagnostic::same(*issued,*bound),@"prepared latest request was not issued");active_=*issued;require(imageAvailability_.begin(active_,emptyConfirmed_,[self stoppedAt:active_.target]),@"image availability generation setup");activeSourceSHA_=nil;audioRequestEpoch_=audioEpoch_;audioRequestTrack_=active_.track;audioRequestTarget_=active_.target;target_=active_.target;track_=active_.track;pending_=NO;feedKnown_=NO;videoEnd_=target_;audioEnd_=0;audioIndex_=0;audioNextSample_=target_*2/5;audioReady_=diagnostic::StableAudioReady();audioHeadEditResolved_=NO;enqueuedActive_=NO;frameAck_=NO;audioAck_=NO;clockAck_=NO;phaseWall_=mono();activeRequestWall_=requestTimes_.at(active_.generation);auto token=active_;BOOL single=single_;
 [log_ add:@"target-issued" values:@{@"generation":@(token.generation),@"session":@(token.session),@"target":@(token.target),@"single":@(single),@"emptyPreparation":@(preparation_.generation()),@"track":@(track_),@"epoch":@(audioEpoch_)}];
 const BOOL direct=[m_[@"videoExecution"]isEqualToString:@"in-process-avframe"];require(!m_[@"videoExecution"]||direct,@"unknown private video execution");
 id<ProductVideoFeed>worker=direct?[DirectVideoFeed alloc]:[VideoFeed alloc];
 feed_=[worker initWithManifest:m_ token:token single:single owner:dispatch_get_main_queue() log:log_ frame:^(NSDictionary*f){
  @try{int64_t pts=[f[@"pts"] longLongValue];recurrence::note(1,30,token.generation,active_.generation,pts,[intent_[@"seekId"]unsignedLongLongValue]);auto presentation=policy_.presentationFor(token,pts);if(closing_||!presentation){[log_ add:@"old-frame-rejected" values:@{@"generation":@(token.generation),@"pts":@(pts)}];return;}NSDictionary*adopted=presentation->generation==[f[@"generation"]unsignedLongLongValue]?f:diagnostic::rebindBufferedField(f,*presentation);require(frames_.count<32,@"renderer pending frame bound");[frames_ addObject:adopted];require(surfaceFrames_.count<32,@"surface candidate bound");[surfaceFrames_ addObject:adopted];uint64_t queuedBytes=0;for(NSDictionary*pending in surfaceFrames_)queuedBytes+=[pending[@"decodedBytes"]unsignedLongLongValue];maximumQueuedDecodedBytes_=std::max(maximumQueuedDecodedBytes_,queuedBytes);}@catch(NSException*e){[self fail:e.reason];}
 } done:^(NSDictionary*r){@try{requireVideoWorkerClosed(r,direct);policy_.closeWorker(token,true);feedKnown_=YES;if(!single)continuousProof_=r;if(![r[@"success"] boolValue]&&!closing_){[self fail:r[@"failure"]?:@"producer failed"];return;}if(!single){if(![r[@"cancelled"] boolValue]&&!closing_){size_t expected=([m_[@"videoEnd"] longLongValue]-token.target)/diagnostic::Step;requireVideoRangeComplete(r,direct,expected);}}if(!closing_&&pending_&&(!scrubbing_||frameAck_||!policy_.mayPresent(active_)))[self transition];}@catch(NSException*e){[self fail:e.reason];}}];feed_.launchDeadline=[m_[@"rollingPCM"]boolValue]?activeRequestWall_+5:std::min(activeRequestWall_+5,startWall_+90);[feed_ start];
}
-(NSDictionary*)verifyAudioHeadEdit{
 pollOwnerCancellation();require(!closing_&&!nativeInterrupted.load()&&audioRequestEpoch_==audioEpoch_&&audioRequestTrack_==track_&&audioRequestTarget_==target_&&active_.target==target_&&(audioHeadEditResolved_||baseline_||[self stoppedAt:target_]),@"PCM audio generation/clock changed");
 require(targetPosition_.coveredByAudio(*audioTimeline_,24*diagnostic::Step),@"outside proven PCM window");
 return @{@"track":@(track_),@"generation":@(active_.generation),@"target":@(target_),@"pcmObservedStartSamples":@(pcm_.sourceStart),@"pcmObservedEndSamples":@(pcm_.sourceEnd),@"independentPCMReferenceCompared":@NO,@"predecodedWindowOnly":@NO};
}
-(void)recordAudioState:(NSString*)reason {
 if(!audio_||!sync_||!active_.generation)return;CMTime raw=kCMTimeInvalid;Float64 rate=-1;OSStatus status=CMTimebaseGetTimeAndRate(sync_.timebase,&raw,&rate);
 [log_ add:@"PCM-readiness-state" values:@{@"reason":reason,@"generation":@(active_.generation),@"epoch":@(audioEpoch_),@"track":@(track_),@"target":@(target_),@"clockStatus":@(status),@"clock":timeJSON(raw),@"rate":@(rate),@"status":@(audio_.status),@"error":audio_.error.description?:[NSNull null],@"readyForMore":@(audio_.readyForMoreMediaData),@"sufficient":@(audio_.hasSufficientMediaDataForReliablePlaybackStart),@"coverageValid":@(audioCoverageValid_),@"coverageStart":@(audioStart_),@"coverageEnd":@(audioEnd_),@"nextBufferIndex":@(audioIndex_),@"stableReadySeconds":@(audioReady_.elapsed(mono()))}];
}
-(void)feedQueues{
 if(bufferedPreparing_||audioBarrier_||flushPending_||!pcm_||closing_||(pending_&&!scrubbing_))return;
 CMTime clock=[sync_ currentTime];double seconds=CMTimeGetSeconds(clock);if(!std::isfinite(seconds))return;int64_t nowTicks=(int64_t)floor(seconds*120000);
 while(frames_.count){if(!policy_.mayPresent(active_)){[frames_ removeAllObjects];break;}if(!frameAck_&&enqueuedActive_)break;NSDictionary*f=frames_[0];int64_t pts=[f[@"pts"] longLongValue];if(pts>nowTicks+31*diagnostic::Step)break;if(!frameAck_){BOOL timing=[f[@"sourceTimingValidated"]boolValue];require(imageAvailability_.enqueue(active_,pts,timing),@"single timing-admitted image input required");activeSourceSHA_=[f[@"sha"] isKindOfClass:NSString.class]?f[@"sha"]:nil;}videoEnqueues_++;if(baseline_&&pts<nowTicks)lateVideoEnqueues_++;require(pts==videoEnd_,@"surface coverage must be contiguous");videoEnd_=pts+diagnostic::Step;recurrence::note(1,31,active_.generation,[intent_[@"seekId"]unsignedLongLongValue],pts,videoEnd_);enqueuedActive_=YES;[log_ add:@"surface-frame-admitted" values:@{@"generation":f[@"generation"],@"pts":@(pts),@"clock":timeJSON(clock),@"interval":@(playInterval_),@"playing":@(baseline_),@"created":f[@"created"],@"enqueued":@(mono()),@"pendingFrames":@(frames_.count),@"surfaceID":f[@"surfaceID"],@"surfaceBytes":f[@"surfaceBytes"],@"sha":f[@"sha"]}];[frames_ removeObjectAtIndex:0];}
 require(audio_.status!=AVQueuedSampleBufferRenderingStatusFailed,[NSString stringWithFormat:@"audio renderer failed before feed: %@",audio_.error.description?:@"status"]);if(pending_)return;if(!audioHeadEditResolved_){[log_ add:@"past-empty-edit-resolved" values:[self verifyAudioHeadEdit]];audioHeadEditResolved_=YES;}
 [pcm_ prefetchAt:(int64_t)floor(seconds*48000) playing:baseline_];while(audioHeadEditResolved_&&audio_.readyForMoreMediaData){id buffer=[pcm_ bufferForTrack:track_ sample:audioNextSample_];if(!buffer)break;CMSampleBufferRef b=(__bridge CMSampleBufferRef)buffer;CMTime pts=CMSampleBufferGetOutputPresentationTimeStamp(b);if(CMTimeGetSeconds(pts)>seconds+(double)pcmwindow::PrerollSamples/48000)break;if(audioCoverageValid_)require(CMTimeConvertScale(pts,120000,kCMTimeRoundingMethod_RoundHalfAwayFromZero).value==audioEnd_,@"runtime AAC queue gap");if(!audioCoverageValid_)audioStart_=CMTimeConvertScale(pts,120000,kCMTimeRoundingMethod_RoundHalfAwayFromZero).value;[self verifyAudioHeadEdit];[audio_ enqueueSampleBuffer:b];CMTime end=CMTimeAdd(pts,CMSampleBufferGetOutputDuration(b));audioEnd_=CMTimeConvertScale(end,120000,kCMTimeRoundingMethod_RoundHalfAwayFromZero).value;audioNextSample_=CMTimeConvertScale(end,48000,kCMTimeRoundingMethod_RoundTowardZero).value;audioCoverageValid_=YES;[log_ add:@"pcm-enqueued" values:@{@"generation":@(active_.generation),@"epoch":@(audioEpoch_),@"track":@(track_),@"index":@(audioIndex_),@"pts":timeJSON(pts),@"end":timeJSON(end),@"bytes":@(CMBlockBufferGetDataLength(CMSampleBufferGetDataBuffer(b))),@"target":@(active_.target)}];audioIndex_++;}
 require(audio_.status!=AVQueuedSampleBufferRenderingStatusFailed,[NSString stringWithFormat:@"audio renderer failed: %@",audio_.error.description?:@"status"]);
}
-(void)captureMetrics:(NSString*)label completion:(void(^)(NSDictionary*))completion{
 // No AV video renderer exists. Keep the stopped-clock barrier but never report
 // its removed metrics as zero drops; actual image cadence comes from Renderer.
 require(!pendingMetrics_,@"metrics ownership bound");pendingMetrics_++;
 uint64_t generation=active_.generation,interval=playInterval_;double requested=mono();CMTime requestedTime;auto requestedClock=[self productClock:&requestedTime];diagnostic::MetricSnapshot requestSnapshot{clockCommandID_,[intent_[@"sequence"]unsignedLongLongValue],generation,requestedClock.time,requestedClock.rate};
 dispatch_async(dispatch_get_main_queue(),^{pendingMetrics_--;@try{
  CMTime returnedTime;auto returnedClock=[self productClock:&returnedTime];diagnostic::MetricSnapshot returnedSnapshot{clockCommandID_,[intent_[@"sequence"]unsignedLongLongValue],active_.generation,returnedClock.time,returnedClock.rate};
  require(closing_||(requestedClock.valid&&returnedClock.valid&&requestSnapshot.matches(returnedSnapshot)),@"stopped clock/sequence/generation changed");
  NSDictionary*d=@{@"label":label,@"interval":@(interval),@"generation":@(generation),@"sequence":@(requestSnapshot.sequence),@"clockCommandID":@(requestSnapshot.command),@"validStoppedIntervalEndpoint":@(!closing_&&requestSnapshot.matches(returnedSnapshot)),@"requested":@(requested),@"returned":@(mono()),@"requestedTime":timeJSON(requestedTime),@"returnedTime":timeJSON(returnedTime),@"requestedRate":@(requestedClock.rate),@"returnedRate":@(returnedClock.rate),@"unavailable":@YES,@"reason":@"AV video renderer removed; use DOM presentation evidence"};
  if(metrics_.count>=64)[metrics_ removeObjectAtIndex:0];[metrics_ addObject:d];[log_ add:@"presentation-clock-endpoint" values:d];if(completion&&!closing_)completion(d);
 }@catch(NSException*e){[self fail:e.reason];}});
}
-(BOOL)ackStopped{
 if(!policy_.mayPresent(active_))return NO;
 if(frameAck_||flushPending_||audioBarrier_||!videoFlushConfirmed_||!enqueuedActive_||![self stoppedAt:active_.target])return frameAck_;
 if(!surfaces_.drawn(active_.generation,active_.target))return NO;
 require(imageAvailability_.observe(active_,true,true),@"DOM image generation");
 require(mono()-activeRequestWall_<=5,@"late DOM image availability");require(policy_.acknowledgeDisplayed(active_,active_.target,videoFlushConfirmed_&&enqueuedActive_&&emptyConfirmed_,true),@"DOM image policy");frameAck_=YES;lastDisplayed_=active_.target;clockAck_=YES;
 [log_ add:@"DOM-image-drawn" values:@{@"generation":@(active_.generation),@"target":@(active_.target),@"sourceSHA":activeSourceSHA_?:[NSNull null],@"physicalScanoutVerified":@NO,@"requestLatency":@(mono()-activeRequestWall_)}];return YES;
}
-(diagnostic::Reserve)verifiedVideoReserve{
 std::vector<int64_t>pendingPTS;for(NSDictionary*f in frames_){int64_t pts=[f[@"pts"] longLongValue];require(diagnostic::onGrid(pts,policy_.timeline()),@"pending reserve source time");require(diagnostic::reserveEntryMatches(active_,[f[@"session"] unsignedLongLongValue],[f[@"generation"] unsignedLongLongValue],(f[@"sample"]!=nil||([f[@"image"]isKindOfClass:DeferredFieldImage.class]&&[f[@"image"]decodedReady])),[f[@"sourceTimingValidated"]boolValue]),@"pending reserve stale/released/unverified frame");pendingPTS.push_back(pts);}
 return diagnostic::verifiedReserve(active_.target,videoEnd_,pendingPTS,policy_.timeline());
}
-(void)readProductCommands{
 if(!diagnostic::mayDispatchProductCommands(pendingMetrics_))return;
 NSArray*messages=[ownerCommands copy];[ownerCommands removeAllObjects];
 for(NSDictionary*v in messages){
  NSSet*keys=[NSSet setWithArray:@[@"generation",@"sourceKey",@"sequence",@"seekId",@"targetTime",@"playing",@"rate",@"audioTrack",@"volume",@"muted"]];
  require(v.count==keys.count&&[[NSSet setWithArray:v.allKeys]isEqualToSet:keys],@"product command keys");
  require([v[@"generation"] isEqual:m_[@"owner"][@"generation"]]&&[v[@"sourceKey"] isEqual:m_[@"owner"][@"sourceKey"]],@"product owner");
  for(NSString*k in @[@"sequence",@"seekId",@"targetTime",@"rate",@"audioTrack",@"volume"]){require([v[k]isKindOfClass:NSNumber.class]&&CFGetTypeID((__bridge CFTypeRef)v[k])!=CFBooleanGetTypeID()&&std::isfinite([v[k]doubleValue]),@"product numeric command");}
  for(NSString*k in @[@"playing",@"muted"])require(CFGetTypeID((__bridge CFTypeRef)v[k])==CFBooleanGetTypeID(),@"product boolean command");
  double seq=[v[@"sequence"]doubleValue],seek=[v[@"seekId"]doubleValue],track=[v[@"audioTrack"]doubleValue],seconds=[v[@"targetTime"]doubleValue];
  require(seq>=1&&seq<=9007199254740991.0&&floor(seq)==seq&&seek>=1&&seek<=seq&&floor(seek)==seek&&track>=0&&track<=2&&floor(track)==track,@"product monotonic identifiers");
  require(diagnostic::productControlsAllowed([v[@"rate"]doubleValue],[v[@"volume"]doubleValue],[v[@"muted"]boolValue],m_[@"allowUnmutedTrial"]),@"diagnostic controls scope");
  auto position=[self positionFor:seconds];int64_t ticks=position.field;require(position.coveredByAudio(*audioTimeline_,24*diagnostic::Step)&&ticks>=([m_[@"rollingPCM"]boolValue]?policy_.timeline().first:diagnostic::First+300*diagnostic::Step)&&position.coveredByTicks(policy_.timeline().first,policy_.timeline().end,24*diagnostic::Step),@"qualified exact source target");
  BOOL changed=!intent_||seek!=[intent_[@"seekId"]doubleValue];BOOL audioChanged=intent_&&track!=[intent_[@"audioTrack"]doubleValue];
  if(intent_){require(seq>[intent_[@"sequence"]doubleValue]&&seek>=[intent_[@"seekId"]doubleValue],@"product command order");if(!changed)require(seconds==[intent_[@"targetTime"]doubleValue],@"target changed without seek");}
  else require(![v[@"playing"]boolValue]&&seek==1,@"initial stopped product intent");
  if(audioChanged&&!changed)require(!baseline_&&[self stoppedAt:target_],@"diagnostic audio selection requires stopped exact target");
  productStop_.cancel();intent_=[v copy];[log_ add:@"product-intent" values:intent_];audio_.volume=[v[@"volume"]floatValue];audio_.muted=[v[@"muted"]boolValue];
  if(!started_){[self begin:@"product-controller-protocol-no-UI-input"];continue;}
  if(!pcm_)continue;
  if(changed||audioChanged){[self issueProductSeek];continue;}
  if(![v[@"playing"]boolValue]){
   [self recordStartSummary:@"cancelled-by-pause"];productStart_.cancel();productStop_.begin([intent_[@"sequence"]unsignedLongLongValue],mono());
   [self setClockRate:0 time:kCMTimeInvalid host:kCMTimeInvalid reason:@"pause"];productPlayPending_=NO;productPlayStarted_=NO;
   [log_ add:@"product-pause-request" values:@{@"sequence":intent_[@"sequence"],@"requestedMonotonic":@(productStop_.requestedAt())}];
  }else if(productReady_&&!productPlayStarted_&&!productPlayPending_){productPlayPending_=YES;productPlayPendingAt_=mono();}
 }
}
-(void)endVideoCoverageEpisode:(NSString*)reason recovered:(BOOL)recovered{
 if(!videoCoverageGapOpen_)return;
 [log_ add:@"video-coverage-episode-ended" values:@{@"clock":timeJSON(sync_.currentTime),@"durationSeconds":@(mono()-videoGapStart_),@"videoEnd":@(videoEnd_),@"recovered":@(recovered),@"reason":reason}];videoCoverageGapOpen_=NO;
}
-(nativeplayback::SourcePosition)positionFor:(double)seconds{
 try{return nativeplayback::sourcePosition(seconds,policy_.timeline(),[m_[@"containingField"]boolValue]);}catch(const std::exception&e){require(false,[NSString stringWithUTF8String:e.what()]);return {};}
}
-(BOOL)reuseBufferedVideo{
 return diagnostic::guardBufferedSeek([&]()->bool{
 auto stamps=diagnostic::bufferedFieldStamps(surfaceFrames_);auto plan=diagnostic::BufferedSeekPlan::make(stamps,active_.session,active_.generation,active_.target,targetPosition_.field,policy_.timeline());
 if(!plan||!targetPosition_.coveredByTicks(plan->target,plan->target+plan->retainedCount*diagnostic::Step,0))return NO;
 auto next=policy_.reuse(*plan,[intent_[@"audioTrack"]unsignedIntValue]);if(!next)return NO;
 const auto previous=active_;NSMutableArray*suffix=[NSMutableArray arrayWithCapacity:plan->retainedCount];
 for(NSUInteger i=plan->discardPrefix;i<surfaceFrames_.count;i++)[suffix addObject:diagnostic::rebindBufferedField(surfaceFrames_[i],*next)];
 [frames_ removeAllObjects];[surfaceFrames_ removeAllObjects];[frames_ addObjectsFromArray:suffix];[surfaceFrames_ addObjectsFromArray:suffix];
 active_=*next;target_=active_.target;track_=active_.track;requestWall_=activeRequestWall_=mono();requestTimes_.clear();requestTimes_[active_.generation]=requestWall_;phase_=@"product-buffered-seek";pending_=NO;bufferedPreparing_=YES;
 imageAvailability_.cancel();videoEnd_=target_;audioEnd_=0;audioIndex_=0;audioNextSample_=target_*2/5;audioReady_=diagnostic::StableAudioReady();audioHeadEditResolved_=NO;audioCoverageValid_=NO;enqueuedActive_=NO;frameAck_=audioAck_=clockAck_=NO;emptyConfirmed_=videoFlushConfirmed_=YES;activeSourceSHA_=nil;
 [self setClockRate:0 time:CMTimeMake(targetPosition_.value,targetPosition_.scale) host:kCMTimeInvalid reason:@"buffered-seek-anchor"];
 [log_ add:@"buffered-seek-reused" values:@{@"previousGeneration":@(previous.generation),@"generation":@(active_.generation),@"target":@(target_),@"retainedFields":@(plan->retainedCount),@"discardedPrefix":@(plan->discardPrefix),@"sameWorkerRetained":@YES,@"requestedClock":timeJSON(CMTimeMake(targetPosition_.value,targetPosition_.scale))}];
 [self replaceAudio:0];return true;
 },[&](const char*reason){[self fail:[NSString stringWithUTF8String:reason]?:@"buffered seek failure"];});
}
-(void)issueProductSeek{
 if(!pcm_||!intent_||closing_)return;
 CMTime previousClock;auto previousSample=[self productClock:&previousClock];auto requested=[self positionFor:[intent_[@"targetTime"]doubleValue]];
 BOOL prepared=productReady_&&!baseline_&&!productStop_.pending()&&!productStart_.pending()&&!productPlayPending_&&!pending_&&!bufferedPreparing_&&!pendingMetrics_&&!preparation_.pending()&&!audioBarrier_&&!flushPending_&&feed_&&!feed_.ended&&!feed_.cancelled&&!scrubbing_&&[m_[@"deferredImages"]boolValue]&&[m_[@"rollingPCM"]boolValue]&&![intent_[@"playing"]boolValue]&&[intent_[@"audioTrack"]unsignedIntValue]==track_;
 if(previousSample.valid&&diagnostic::repeatsStoppedImage(prepared,frameAck_&&audioAck_&&clockAck_&&policy_.canResume()&&[self stoppedAt:active_.target],active_.target,CMTimeMake(targetPosition_.value,targetPosition_.scale),previousClock,previousSample.rate,CMTimeMake(requested.value,requested.scale),requested.field)){
  [log_ add:@"same-stopped-seek-retained" values:@{@"generation":@(active_.generation),@"target":@(active_.target),@"sequence":intent_[@"sequence"],@"seekId":intent_[@"seekId"]}];[self emitProduct:@"paused"];return;
 }
 BOOL reuse=previousSample.valid&&diagnostic::stoppedForwardSeek(prepared,previousClock,previousSample.rate,CMTimeMake(requested.value,requested.scale));
 [self endVideoCoverageEpisode:@"seek" recovered:NO];productStop_.cancel();[self recordStartSummary:@"cancelled-by-seek"];productStart_.cancel();hasConfirmedProductTime_=NO;metricsStartReady_=NO;productReady_=NO;productPlayPending_=NO;productPlayStarted_=NO;baseline_=NO;bufferedPreparing_=NO;
 targetPosition_=requested;[pcm_ selectSample:targetPosition_.field*2/5];
 if(reuse&&[self reuseBufferedVideo])return;
 [self request:targetPosition_.field track:[intent_[@"audioTrack"]unsignedIntValue] single:NO phase:@"product-seek"];
}
-(void)setClockRate:(double)rate time:(CMTime)time host:(CMTime)host reason:(NSString*)reason{
 require(NSThread.isMainThread,@"clock command must run on main queue");NSDictionary*before=nativeClockSnapshot(sync_);uint64_t command=++clockCommandID_;
 if(!applyNativeClock(sync_,rate,time,host)){[log_ add:@"clock-not-created" values:@{@"commandID":@(command),@"reason":reason}];return;}
 [log_ add:@"clock-command" values:@{@"commandID":@(command),@"reason":reason,@"rate":@(rate),@"time":timeJSON(time),@"host":timeJSON(host),@"sequence":intent_[@"sequence"]?:@0,@"seekId":intent_[@"seekId"]?:@0,@"generation":@(active_.generation),@"audioEpoch":@(audioEpoch_),@"before":before,@"after":nativeClockSnapshot(sync_)}];
}
-(void)recordStartSummary:(NSString*)outcome{
 if(!productStart_.pending())return;
 [log_ add:@"product-startup-clock-summary" values:@{@"sequence":@(startSequence_),@"seekId":@(startSeek_),@"outcome":outcome,@"stoppedAnchor":@(productStart_.anchor()),@"minimumObservedTime":@(productStart_.minimumObservedTime()),@"maximumBackwardSeconds":@(productStart_.maximumBackwardSeconds()),@"observedSamples":@(productStart_.samples()),@"beforeAnchorSamples":@(productStart_.beforeAnchorSamples()),@"observedDurationSeconds":@(productStart_.elapsed()),@"clockValuesClamped":@NO}];
}
-(diagnostic::ProductClock)productClock:(CMTime*)raw{
 *raw=kCMTimeInvalid;Float64 rate=-1;OSStatus status=CMTimebaseGetTimeAndRate(sync_.timebase,raw,&rate);
 return {status==0&&CMTIME_IS_NUMERIC(*raw)&&raw->epoch==0,CMTimeGetSeconds(*raw),rate};
}
-(void)emitProduct:(NSString*)phase{
 BOOL starved=[phase isEqualToString:@"starved"];if(!intent_||(closing_&&!starved))return;
 CMTime raw;auto clock=[self productClock:&raw];require(diagnostic::validProductClock(clock),@"invalid atomic product clock");
 if(!diagnostic::mayPublishClock(clock,[phase isEqualToString:@"playing"],[intent_[@"playing"]boolValue],[intent_[@"rate"]doubleValue]))return;
 if(productPlayPending_&&clock.rate!=0)return;
 if(productStart_.pending()&&(clock.rate!=0||clock.time<productStart_.anchor()))return;
 BOOL ready=!starved&&productReady_&&!pending_&&!flushPending_&&!audioBarrier_;double rate=clock.rate;
 if(ready&&([phase isEqualToString:@"paused"]||[phase isEqualToString:@"playing"])){
  require(!hasConfirmedProductTime_||clock.time>=confirmedProductTime_,@"confirmed product clock regressed without seek");
  confirmedProductTime_=clock.time;hasConfirmedProductTime_=YES;
 }
 NSDictionary*v=@{@"generation":intent_[@"generation"],@"sourceKey":intent_[@"sourceKey"],@"revision":@(++observationRevision_),@"sequence":intent_[@"sequence"],@"seekId":intent_[@"seekId"],@"phase":phase,@"time":@(clock.time),@"rate":@(rate),@"audioTrack":@(track_),@"volume":@(audio_.volume),@"muted":@(audio_.muted),@"videoReady":@(ready),@"audioReady":@(ready),@"error":starved?@"media":[NSNull null]};
 NSData*d=[NSJSONSerialization dataWithJSONObject:@{@"type":@"observation",@"value":v} options:0 error:nil];[self enqueueProductPacket:d];
 [log_ add:@"product-observation" values:v];
}
-(void)enqueueProductPacket:(NSData*)d{
 require(d&&d.length<4096&&protocolWrites_<4,@"protocol output bound");protocolWrites_++;
 dispatch_async(protocolQueue_,^{BOOL ok=fwrite(d.bytes,1,d.length,stdout)==d.length&&fputc('\n',stdout)!=EOF&&fflush(stdout)==0;dispatch_async(dispatch_get_main_queue(),^{protocolWrites_--;if(!ok)[self fail:@"product protocol output failed"];});});
}
-(void)tick{
 [self pollSurfaces];recurrence::resourceSample();
 pollOwnerCancellation();pollCount_++;if(finished_)return;
 if(nativeInterrupted.load()&&!failure_)[self fail:@"owner cancellation or invalid control input"];
 if(ownerClose&&!closing_){[log_ add:@"product-close-request" values:@{}];[self close];}
 if(finalizing_){finalization_.tick(mono());if(finalization_.failed()&&!failure_)failure_=@"final I/O deadline; owner retained";return;}
 if(progressPending_&&mono()-progressAt_>2&&!failure_)[self fail:@"progress I/O deadline; owner retained"];
 if(![m_[@"packagedRuntime"]boolValue]&&!closing_&&mono()>nextProgress_&&!progressPending_){nextProgress_=mono()+1;[self writeProgress];}
 if(closing_){[self closeTick];return;}
 [self readProductCommands];if(!started_)return;
 if(![m_[@"rollingPCM"]boolValue]&&mono()-startWall_>30){[self fail:@"product diagnostic overall deadline"];return;}
 if(!pcm_){if(mono()-startWall_>5)[self fail:@"initial PCM preparation deadline"];return;}
 if(pending_&&[self stoppedAt:target_])[self transition];[self issueIfReady];[self feedQueues];[self sendSurface];
 if(productStop_.pending()){
  CMTime raw;auto clock=[self productClock:&raw];auto stop=productStop_.observe([intent_[@"sequence"]unsignedLongLongValue],mono(),clock);
  if(stop==diagnostic::StopObservation::Invalid||stop==diagnostic::StopObservation::Expired||stop==diagnostic::StopObservation::Superseded){[self fail:@"actual product stop clock invalid/stale/deadline"];return;}
  if(stop==diagnostic::StopObservation::Stopped&&!pendingMetrics_){
   [log_ add:@"product-pause-confirmed" values:@{@"sequence":intent_[@"sequence"],@"clock":timeJSON(raw),@"actualRate":@(clock.rate),@"requestedMonotonic":@(productStop_.requestedAt()),@"confirmedMonotonic":@(mono())}];
   productStop_.cancel();[self endVideoCoverageEpisode:@"pause" recovered:NO];baseline_=NO;metricsStartReady_=NO;[self captureMetrics:@"product-pause" completion:^(NSDictionary*d){[self emitProduct:@"paused"];}];
  }
 }
 if((pending_||bufferedPreparing_||flushPending_||audioBarrier_)&&mono()-requestWall_>5){[self fail:@"request barrier deadline"];return;}
 if(!pending_&&!bufferedPreparing_&&!flushPending_&&!audioBarrier_&&!productReady_){
  [self ackStopped];
  if(!audioAck_&&audioReady_.observe(mono(),[self stoppedAt:active_.target],(audio_.hasSufficientMediaDataForReliablePlaybackStart&&audioCoverageValid_&&targetPosition_.coveredByTicks(audioStart_,audioEnd_,24*diagnostic::Step)))==diagnostic::ReadyObservation::Ready)audioAck_=policy_.acknowledgeAudio(active_,track_);
  if(frameAck_&&audioAck_){require(mono()-activeRequestWall_<=5,@"late seek-ready");productReady_=YES;[self emitProduct:@"paused"];productPlayPending_=[intent_[@"playing"]boolValue];if(productPlayPending_)productPlayPendingAt_=mono();}
  else if(mono()-activeRequestWall_>5){[self fail:@"product image/audio target readiness deadline"];return;}
 }
 if(productPlayPending_&&!pendingMetrics_&&productReady_&&[intent_[@"playing"]boolValue]&&!pending_){
  require(mono()-productPlayPendingAt_<5,@"stop-before-resume/preroll deadline");
  CMTime stoppedTime;auto stoppedClock=[self productClock:&stoppedTime];require(diagnostic::validProductClock(stoppedClock),@"invalid clock before resume");
  auto reserve=[self verifiedVideoReserve];
  if(diagnostic::readyForProductStart(stoppedTime.value,stoppedTime.timescale,stoppedClock.rate,reserve,audioEnd_,policy_.canResume())){
   if(!metricsStartReady_){metricsSequence_=[intent_[@"sequence"]unsignedLongLongValue];++playInterval_;uint64_t sequence=metricsSequence_;[self captureMetrics:@"product-start" completion:^(NSDictionary*d){if(sequence==[intent_[@"sequence"]unsignedLongLongValue]&&productPlayPending_&&!closing_)metricsStartReady_=YES;}];return;}
   require(productStart_.begin(stoppedClock,productPlayPendingAt_),@"play requires measured stopped anchor");startSequence_=[intent_[@"sequence"]unsignedLongLongValue];startSeek_=[intent_[@"seekId"]unsignedLongLongValue];startupClockRecorded_=NO;
   productPlayPending_=NO;productPlayStarted_=YES;playRequestWall_=mono();baseline_=YES;metricsStartReady_=NO;NSString*mode=m_[@"clockStartMode"]?:@"explicit-host-now";require([@[@"implicit",@"explicit-source",@"explicit-host-now"]containsObject:mode],@"clock start mode");CMTime desired=[mode isEqualToString:@"implicit"]?kCMTimeInvalid:stoppedTime;CMTime hostTime=[mode isEqualToString:@"explicit-host-now"]?CMClockGetTime(CMClockGetHostTimeClock()):kCMTimeInvalid;startTraceCount_=0;[self setClockRate:1 time:desired host:hostTime reason:mode];[log_ add:@"product-play-request" values:@{@"sequence":intent_[@"sequence"],@"clock":timeJSON(sync_.currentTime)}];
  }
 }
 if(productStart_.pending()){
  require(++startTraceCount_<=1100,@"startup trace bound");CMTime raw;auto clock=[self productClock:&raw];[log_ add:@"startup-clock-audit" values:@{@"commandID":@(clockCommandID_),@"sequence":intent_[@"sequence"],@"seekId":intent_[@"seekId"],@"audioEpoch":@(audioEpoch_),@"videoStartTicks":@(target_),@"videoEndTicks":@(videoEnd_),@"audioStartTicks":@(audioStart_),@"audioEndTicks":@(audioEnd_),@"decisionClock":timeJSON(raw),@"decisionRate":@(clock.rate),@"snapshot":nativeClockSnapshot(sync_)}];
  auto start=productStart_.observe(mono(),clock);if(clock.valid&&clock.rate>0){if(clock.time*120000<target_)startupBelowVideo_++;if(clock.time*120000<audioStart_)startupBelowAudio_++;}
  if(start==diagnostic::StartObservation::Invalid||start==diagnostic::StartObservation::Expired){[self recordStartSummary:@"invalid-or-expired"];[self fail:@"actual product start clock invalid/deadline"];return;}
  if(start==diagnostic::StartObservation::Started){
   [log_ add:@"product-play-confirmed" values:@{@"sequence":intent_[@"sequence"],@"clock":timeJSON(raw),@"actualRate":@(clock.rate),@"stoppedAnchor":@(productStart_.anchor())}];[self recordStartSummary:@"started"];productStart_.cancel();
  }else if(clock.rate>0&&!startupClockRecorded_){
   startupClockRecorded_=YES;[log_ add:@"product-startup-clock-before-anchor" values:@{@"sequence":intent_[@"sequence"],@"clock":timeJSON(raw),@"actualRate":@(clock.rate),@"stoppedAnchor":@(productStart_.anchor()),@"published":@NO}];
  }
 }
 if(baseline_){
  CMTime time;auto sampled=[self productClock:&time];require(diagnostic::validProductClock(sampled),@"invalid running clock");int64_t ticks=CMTimeConvertScale(time,120000,kCMTimeRoundingMethod_RoundTowardZero).value;double rate=sampled.rate;
  if(rate==0&&mono()-playRequestWall_>5){[self fail:@"actual product play clock deadline"];return;}
  if(rate>0&&(ticks>=videoEnd_||ticks>=audioEnd_)){
   recurrence::note(1,50,active_.generation,[intent_[@"seekId"]unsignedLongLongValue],ticks,videoEnd_);recurrence::note(1,51,active_.generation,[intent_[@"seekId"]unsignedLongLongValue],ticks,audioEnd_);
   BOOL observeOnly=[m_[@"observeVideoCoverageGaps"]boolValue]&&ticks<audioEnd_;
   if(!videoCoverageGapOpen_){gaps_++;videoCoverageGapOpen_=YES;videoGapStart_=mono();[log_ add:@"product-input-starvation" values:@{@"clock":timeJSON(time),@"videoEnd":@(videoEnd_),@"audioEnd":@(audioEnd_),@"continuedForObservation":@(observeOnly),@"qualityFailureRecorded":@YES}];}
   if(!observeOnly){[self setClockRate:0 time:kCMTimeInvalid host:kCMTimeInvalid reason:@"coverage-failure-stop"];mediaRecoveryPending_=YES;[self fail:@"input coverage exhausted"];return;}
  }else if(rate>0&&ticks<videoEnd_&&ticks<audioEnd_&&videoCoverageGapOpen_){[self endVideoCoverageEpisode:@"coverage-restored" recovered:YES];}
  if(m_[@"handoffTime"]&&rate>0&&sampled.time>=[m_[@"handoffTime"]doubleValue]){
   double limit=[m_[@"handoffTime"]doubleValue];require(std::isfinite(limit)&&limit>target_/120000.0&&limit<[m_[@"videoEnd"]doubleValue]/120000.0,@"invalid bounded handoff");
   [self setClockRate:0 time:kCMTimeInvalid host:kCMTimeInvalid reason:@"bounded-window-handoff"];productPlayPending_=NO;productStart_.cancel();baseline_=NO;[self emitProduct:@"paused"];return;
  }
  [log_ add:@"running-coverage" values:@{@"interval":@(playInterval_),@"generation":@(active_.generation),@"clock":timeJSON(time),@"rate":@(rate),@"videoEnd":@(videoEnd_),@"audioEnd":@(audioEnd_),@"pendingFrames":@(frames_.count)}];
  if(ticks>=[m_[@"videoEnd"]longLongValue]-3*diagnostic::Step){[self fail:@"bounded diagnostic end reached without pause"];return;}
 }
 if(!pendingMetrics_&&mono()>=nextObservation_){nextObservation_=mono()+.033;[self emitProduct:baseline_&&CMTimebaseGetRate(sync_.timebase)>0?@"playing":productReady_?@"paused":@"seeking"];}
}

-(void)finishFunctional{[log_ add:@"functional-phases-complete" values:@{@"physicalScrubVerified":@NO,@"audibleSyncVerified":@NO}];[self close];}
-(void)fail:(NSString*)reason{
 if(!failure_){recurrence::capture([reason isEqualToString:@"input coverage exhausted"]?2:1);failure_=reason?:@"unknown failure";@try{[self recordAudioState:@"failure"];[log_ add:@"failure" values:@{@"reason":failure_,@"phase":phase_?:@"setup"}];}@catch(NSException*e){readinessSnapshotFailed_=YES;}}
 if(finalizing_)finalization_.cancel();policy_.fail();[self close];
}
-(void)endPlaybackActivity{if(playbackActivity_){[NSProcessInfo.processInfo endActivity:playbackActivity_];playbackActivity_=nil;[log_ add:@"playback-activity-end" values:@{}];}}
-(void)close{
 [self recordStartSummary:@"closing"];productStart_.cancel();productStop_.cancel();
 if(closing_)return;bufferedPreparing_=NO;[self endVideoCoverageEpisode:@"close" recovered:NO];closing_=YES;stopWall_=mono();cancelPrepare_=true;[pcm_ close];policy_.close();imageAvailability_.cancel();if(feed_)feed_.cancelled=YES;[self setClockRate:0 time:kCMTimeInvalid host:kCMTimeInvalid reason:@"close-stop"];[self endPlaybackActivity];[frames_ removeAllObjects];[surfaceFrames_ removeAllObjects];label_.stringValue=@"診断の所有処理を終了しています";
}
-(void)writeProgress{
 progressPending_=YES;progressAt_=mono();NSDictionary*p=@{@"pid":@((int)getpid()),@"phase":phase_?:@"setup",@"started":@(started_),@"closing":@(closing_),@"producerPID":@(feed_?feed_.pid:0),@"producerEnded":@(feed_?feed_.ended:YES),@"pendingTarget":@(pending_),@"target":@(target_),@"currentTime":sync_?timeJSON([sync_ currentTime]):@{},@"failure":failure_?:[NSNull null],@"videoEnqueues":@(videoEnqueues_)};NSString*path=[[resultPath_ stringByDeletingLastPathComponent]stringByAppendingPathComponent:@"progress.json"];
 dispatch_async(dispatch_get_global_queue(QOS_CLASS_UTILITY,0),^{@autoreleasepool{NSError*e=nil;BOOL ok=NO;NSString*exception=nil;@try{NSData*d=[NSJSONSerialization dataWithJSONObject:p options:0 error:&e];ok=d&&[d writeToFile:path options:NSDataWritingAtomic error:&e];}@catch(NSException*x){exception=x.reason;}NSString*reason=exception?:e.description;dispatch_async(dispatch_get_main_queue(),^{progressPending_=NO;if(mono()-progressAt_>2)[self fail:@"late progress completion"];if(!ok)[self fail:reason?:@"progress write failed"];});}});
}
-(void)closeTick{
 if(mono()-stopWall_>10&&!failure_){failure_=@"cleanup deadline with retained owner";[log_ add:@"failure" values:@{@"reason":failure_,@"phase":@"closing"}];label_.stringValue=@"終了確認待ち — 所有処理を保持しています";}if(cleanupUncertain_)return;
 if(sync_&&intent_&&!stoppedClock_){CMTime raw;auto clock=[self productClock:&raw];if(!diagnostic::validProductClock(clock)||clock.rate!=0)return;stoppedClock_=@{@"generation":intent_[@"generation"],@"sourceKey":intent_[@"sourceKey"],@"sequence":intent_[@"sequence"],@"seekId":intent_[@"seekId"],@"time":@(clock.time),@"rate":@0};[log_ add:@"closed-source-clock" values:stoppedClock_];}
 if(stoppedClock_&&mediaRecoveryPending_){mediaRecoveryPending_=NO;[self emitProduct:@"starved"];}
 if(!audio_)audioRemoved_=YES;
 if(surfaces_.pending()||(pcm_&&!pcm_.drained)||protocolWrites_||progressPending_||preparing_||pendingMetrics_||!feedKnown_||(feed_&&!feed_.ended)||flushPending_||audioBarrier_){if(mono()-stopWall_>10){failure_=failure_?:@"cleanup deadline with retained owner";label_.stringValue=@"終了確認待ち — 所有処理を保持しています";}return;}
 if(audio_&&!audioRemoved_){audioRemoved_=YES;AVSampleBufferAudioRenderer*old=audio_;[old stopRequestingMediaData];[sync_ removeRenderer:old atTime:kCMTimeInvalid completionHandler:^(BOOL removed){dispatch_async(dispatch_get_main_queue(),^{if(!removed){cleanupUncertain_=YES;failure_=failure_?:@"audio close removal unknown";return;}[old flush];audio_=nil;});}];return;}
 if(audio_)return;[self persistAndStop];
}
-(void)persistAndStop{
 if(finalizing_||finished_)return;[self endPlaybackActivity];finalizing_=YES;finalStage_=1;finalStageWall_=mono();finalization_.begin(finalStageWall_);if(log_.overflowed&&![m_[@"rollingPCM"]boolValue])failure_=failure_?:@"event log overflow";if(gaps_)failure_=failure_?:@"input coverage gaps observed; quality gate failed";
 NSInteger dropped=0;BOOL metricsAvailable=playInterval_>0;for(uint64_t interval=1;interval<=playInterval_;interval++){NSDictionary*start=nil,*stop=nil;for(NSDictionary*d in metrics_)if([d[@"interval"]unsignedLongLongValue]==interval){if([d[@"label"]isEqualToString:@"product-start"])start=d;if([d[@"label"]isEqualToString:@"product-pause"])stop=d;}if(!start||!stop||start[@"unavailable"]||stop[@"unavailable"]||![start[@"validStoppedIntervalEndpoint"]boolValue]||![stop[@"validStoppedIntervalEndpoint"]boolValue]||![start[@"generation"]isEqual:stop[@"generation"]]||[stop[@"dropped"]integerValue]<[start[@"dropped"]integerValue]){metricsAvailable=NO;break;}dropped+=[stop[@"dropped"]integerValue]-[start[@"dropped"]integerValue];}if(!metricsAvailable)dropped=-1;BOOL quality=metricsAvailable&&dropped==0&&gaps_==0&&!failure_;
 NSDictionary*result=@{@"readinessSnapshotFailed":@(readinessSnapshotFailed_),@"success":@(!failure_),@"stoppedClock":stoppedClock_?:[NSNull null],@"diagnosticReportedNoDrops":@(quality),@"qualityQualified":@NO,@"originalFileDirect":@YES,@"wholeOriginalHashRead":@NO,@"independentFullVideoReferenceCompared":@NO,@"independentPCMReferenceCompared":@NO,@"deferredImageCount":@(deferredImageCount_),@"deferredImageSeconds":@(deferredImageSeconds_),@"maximumQueuedDecodedBytes":@(maximumQueuedDecodedBytes_),@"decodedQueueLimit":@32,@"deferredSurfaceLimit":@4,@"videoEnqueues":@(videoEnqueues_),@"lateVideoEnqueues":@(lateVideoEnqueues_),@"failure":failure_?:[NSNull null],@"displayCadence":cadence_,@"displayCallbackCount":@(cadenceCount_),@"minObservedDisplayPeriod":@(minDisplayPeriod_),@"maxObservedDisplayPeriod":@(maxDisplayPeriod_),@"subset":@"product-command-controlled-bounded-native-playback",@"predecodedWindowOnly":@NO,@"sourceUnchangedByDesign":@YES,@"productQualified":@NO,@"physicalScrubVerified":@NO,@"audibleSyncVerified":@NO,@"nativeUnderflowCountAvailable":@NO,@"observeVideoCoverageGaps":@([m_[@"observeVideoCoverageGaps"]boolValue]),@"inputCoverageGaps":@(gaps_),@"inputCoverageGapScope":([m_[@"deferredImages"]boolValue]?@"decoded-upper-end-only":@"upper-end-only"),@"startupSamplesBelowVideoCoverage":@(startupBelowVideo_),@"startupSamplesBelowAudioCoverage":@(startupBelowAudio_),@"presentationBackend":@"electron-shared-texture",@"hiddenAVVideoRenderer":@NO,@"nativeDroppedDelta":@(dropped),@"metrics":metrics_,@"eventHistoryTruncated":@(log_.overflowed),@"eventCount":@(log_.count),@"events":[log_ snapshot],@"requiresOwnerExitZero":@YES};
 dispatch_async(dispatch_get_global_queue(QOS_CLASS_UTILITY,0),^{@autoreleasepool{
  NSError*error=nil;NSData*d=nil;BOOL saved=NO;NSString*exception=nil;
  @try{d=[NSJSONSerialization dataWithJSONObject:result options:NSJSONWritingPrettyPrinted error:&error];saved=d&&[d writeToFile:resultPath_ options:NSDataWritingWithoutOverwriting error:&error];}@catch(NSException*e){exception=e.reason;}
  NSString*sha=d?hashBytes(d.bytes,d.length):@"";NSString*writeError=exception?:error.description;
  dispatch_async(dispatch_get_main_queue(),^{
   finalization_.candidateCompleted(saved,mono());if(!saved)failure_=failure_?:writeError?:@"candidate save failed";if(nativeInterrupted.load())failure_=failure_?:@"cancelled during save";
   finalStage_=2;finalStageWall_=mono();NSDictionary*receipt=@{@"type":@"drained",@"stoppedClock":stoppedClock_?:[NSNull null],@"generation":m_[@"owner"][@"generation"],@"nativeDrained":@(policy_.drained()&&(!pcm_||pcm_.drained)&&!preparing_&&!protocolWrites_),@"resultPersisted":@(saved),@"success":@(saved&&!failure_),@"resultSHA256":sha,@"error":failure_?:[NSNull null],@"requiresOwnerExitZero":@YES};
   dispatch_async(dispatch_get_global_queue(QOS_CLASS_UTILITY,0),^{@autoreleasepool{
    NSData*out=[NSJSONSerialization dataWithJSONObject:receipt options:0 error:nil];BOOL wrote=out&&fwrite(out.bytes,1,out.length,stdout)==out.length&&fputc('\n',stdout)!=EOF&&fflush(stdout)==0;
    dispatch_async(dispatch_get_main_queue(),^{finalization_.receiptCompleted(wrote,mono());if(!wrote)failure_=failure_?:@"receipt write failed";if(nativeInterrupted.load())failure_=failure_?:@"cancelled during receipt";finalExit=saved&&wrote&&!failure_&&finalization_.admitted()?0:1;finished_=YES;if(tick_){dispatch_source_cancel(tick_);tick_=nil;}if(audioNotice_){[[NSNotificationCenter defaultCenter]removeObserver:audioNotice_];audioNotice_=nil;}[window_ orderOut:nil];[NSApp stop:nil];[NSApp postEvent:[NSEvent otherEventWithType:NSEventTypeApplicationDefined location:NSZeroPoint modifierFlags:0 timestamp:0 windowNumber:0 context:nil subtype:0 data1:0 data2:0] atStart:NO];});
   }});
  });
 }});
}
@end
int main(int argc,const char*argv[]){@autoreleasepool{
 ownerCommands=[NSMutableArray array];signal(SIGINT,noteSignal);signal(SIGTERM,noteSignal);struct stat controlStat;if(fstat(STDIN_FILENO,&controlStat)!=0||!S_ISFIFO(controlStat.st_mode)||fcntl(STDIN_FILENO,F_SETFL,fcntl(STDIN_FILENO,F_GETFL)|O_NONBLOCK)!=0)return 65;pollOwnerCancellation();fcntl(STDOUT_FILENO,F_SETNOSIGPIPE,1);
 if(argc!=4||(strcmp(argv[3],"--auto-no-ui-input")!=0&&strcmp(argv[3],"--manual")!=0))return 64;NSString*manifestPath=[NSString stringWithUTF8String:argv[1]];NSString*result=[NSString stringWithUTF8String:argv[2]];NSString*expected=[[[manifestPath stringByDeletingLastPathComponent]stringByAppendingPathComponent:@"native-run-1"]stringByAppendingPathComponent:@"native-result.json"];if(![[result stringByStandardizingPath]isEqualToString:expected]||[[NSFileManager defaultManager]fileExistsAtPath:result]||[[NSFileManager defaultManager]fileExistsAtPath:[[result stringByDeletingLastPathComponent]stringByAppendingPathComponent:@"progress.json"]])return 65;NSData*data=[NSData dataWithContentsOfFile:manifestPath];if(!data||data.length>2*1024*1024)return 65;NSDictionary*m=[NSJSONSerialization JSONObjectWithData:data options:0 error:nil];if(![m isKindOfClass:[NSDictionary class]]||[m[@"version"] intValue]!=1)return 65;
 recurrence::configure([m[@"recurrenceEnabled"]boolValue],[m[@"recurrenceSession"]unsignedLongLongValue]);
 if(nativeInterrupted.load())return 1;[NSApplication sharedApplication];[NSApp setActivationPolicy:NSApplicationActivationPolicyAccessory];DisplayDiagnostic*d=[[DisplayDiagnostic alloc]initWithManifest:m result:[NSString stringWithUTF8String:argv[2]] automatic:strcmp(argv[3],"--auto-no-ui-input")==0];NSApp.delegate=d;[NSApp run];return nativeInterrupted.load()?1:finalExit;
}}
