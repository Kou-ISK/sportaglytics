#import "PCMWindowSupply.hpp"
#include "PCMWindowPolicy.hpp"
#include <memory>
@implementation PCMWindowSupply {
 NSDictionary*manifest_;NSArray*proofs_;EventLog*log_;void(^ready_)(NSString*);
 AudioPrefix*current_;AudioPrefix*next_;NSInteger wanted_,loading_;uint64_t epoch_;
 BOOL busy_,closing_,rolling_;std::shared_ptr<std::atomic<bool>> cancel_;std::unique_ptr<nativeplayback::AudioTimeline> timeline_;
}
-(instancetype)initWithManifest:(NSDictionary*)manifest log:(EventLog*)log ready:(void(^)(NSString*))ready {
 if((self=[super init])){manifest_=manifest;log_=log;ready_=ready;rolling_=[manifest[@"rollingPCM"]boolValue];proofs_=manifest[@"pcmWindows"];wanted_=-1;loading_=-1;
 int64_t first=rolling_?[manifest[@"pcmStart"]longLongValue]:pcmwindow::Start,end=rolling_?[manifest[@"pcmEnd"]longLongValue]:pcmwindow::End;
 try{timeline_=std::make_unique<nativeplayback::AudioTimeline>(first,end);}catch(const std::exception&e){require(false,[NSString stringWithUTF8String:e.what()]);}
 if(rolling_){require([manifest[@"pcmTracks"]count]==3&&[manifest[@"layoutSHA"]isKindOfClass:NSString.class],@"PCM rolling source profile");}
 else {int64_t previous=first;require(proofs_.count>0&&proofs_.count<=4,@"PCM window proof bound");for(NSDictionary*w in proofs_){int64_t start=[w[@"start"]longLongValue],stop=[w[@"end"]longLongValue];require(timeline_->validWindow(start,stop)&&start==previous&&[w[@"tracks"]count]==3,@"PCM window partition gap/overlap");previous=stop;}require(previous==end,@"PCM proof terminal coverage");}}return self;
}
-(NSInteger)windowFor:(int64_t)sample {if(sample<timeline_->first||sample>=timeline_->end)return -1;if(rolling_)return timeline_->index(sample);for(NSUInteger i=0;i<proofs_.count;i++)if(sample>=[proofs_[i][@"start"]longLongValue]&&sample<[proofs_[i][@"end"]longLongValue])return i;return -1;}
-(NSDictionary*)proofFor:(NSInteger)index {if(!rolling_)return proofs_[index];auto w=timeline_->window(index);return @{@"start":@(w.start),@"end":@(w.end),@"tracks":manifest_[@"pcmTracks"],@"layoutSHA":manifest_[@"layoutSHA"]};}
-(int64_t)sourceStart{return timeline_->first;}
-(int64_t)sourceEnd{return timeline_->end;}
-(BOOL)coversTarget:(int64_t)ticks reserve:(int64_t)reserve{return timeline_->coversField(ticks,reserve);}
-(BOOL)covers:(int64_t)sample{return current_&&sample>=current_.startSample&&sample<current_.endSample;}
-(void)selectSample:(int64_t)sample {
 require(NSThread.isMainThread&&!closing_,@"PCM select owner");NSInteger index=[self windowFor:sample];require(index>=0,@"PCM seek outside qualified windows");
 // Windows contain immutable original-time samples for every track. A seek
 // within the current range does not invalidate its adjacent read or samples.
 if([self covers:sample])return;
 if(next_&&sample>=next_.startSample&&sample<next_.endSample){current_=next_;next_=nil;return;}
 ++epoch_;if(cancel_)cancel_->store(true);wanted_=index;
 current_=nil;next_=nil;[self pump];
}
-(AudioPrefix*)loadWindow:(NSDictionary*)proof cancel:(std::atomic<bool>*)cancel {return [AudioPrefix load:manifest_ window:proof cancel:cancel log:log_];}
-(void)pump {
 require(NSThread.isMainThread,@"PCM reader owner");if(closing_||busy_||wanted_<0)return;NSInteger index=wanted_;wanted_=-1;loading_=index;busy_=YES;auto token=std::make_shared<std::atomic<bool>>(false);cancel_=token;uint64_t epoch=epoch_;NSDictionary*proof=[self proofFor:index];double began=mono();
 [log_ add:@"pcm-window-load-start" values:@{@"epoch":@(epoch),@"index":@(index),@"startSample":proof[@"start"],@"endSample":proof[@"end"],@"retainedWindows":@(current_?1:0),@"activeReaders":@1}];
 dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED,0),^{@autoreleasepool{AudioPrefix*loaded=nil;NSString*error=nil;@try{loaded=[self loadWindow:proof cancel:token.get()];}@catch(NSException*e){error=e.reason;}
 dispatch_async(dispatch_get_main_queue(),^{busy_=NO;loading_=-1;BOOL accepted=!closing_&&!token->load()&&epoch==epoch_;cancel_.reset();
 [log_ add:@"pcm-window-load-terminal" values:@{@"epoch":@(epoch),@"index":@(index),@"accepted":@(accepted),@"cancelled":@(token->load()),@"seconds":@(mono()-began),@"error":error?:[NSNull null]}];
 @try{if(accepted){if(!loaded){ready_(error?:@"PCM window missing");return;}if(!current_)current_=loaded;else{require(!next_&&current_.endSample==loaded.startSample,@"PCM next window order/bound");next_=loaded;}ready_(nil);}
 [self pump];}@catch(NSException*e){ready_(e.reason);}});}});
}
-(void)prefetchAt:(int64_t)sample playing:(BOOL)playing {
 if(closing_||!current_||next_||busy_||wanted_>=0)return;
 // Playing consumes adjacent windows continuously. Use the free next slot as
 // soon as it is available, including promotion ahead of the source clock.
 // Paused preparation retains its distance threshold; ownership bounds above
 // still allow only current + next and one reader, regardless of tick frequency.
 if(!playing&&sample+pcmwindow::PrefetchSamples<current_.endSample)return;
 NSInteger next=[self windowFor:current_.endSample];if(next<0)return;
 [log_ add:@"pcm-prefetch-request" values:@{@"sample":@(sample),@"playing":@(playing),@"remainingSamples":@(current_.endSample-sample),@"pausedLeadSamples":@(pcmwindow::PrefetchSamples)}];
 wanted_=next;[self pump];
}
-(id)bufferForTrack:(unsigned)track sample:(int64_t)sample {
 require(NSThread.isMainThread&&track<3&&!closing_,@"PCM buffer owner");if(current_&&sample==current_.endSample&&next_){require(next_.startSample==sample,@"PCM handoff continuity");[log_ add:@"pcm-window-promoted" values:@{@"sourceSample":@(sample),@"retainedWindowsBefore":@2}];current_=next_;next_=nil;}
 if(![self covers:sample])return nil;
 require(timeline_->validWindow(current_.startSample,current_.endSample),@"PCM retained range invalid");size_t i=(sample-current_.startSample)/pcmwindow::Chunk;return current_.tracks[track][i];
}
-(void)close {require(NSThread.isMainThread,@"PCM close owner");closing_=YES;++epoch_;wanted_=-1;if(cancel_)cancel_->store(true);current_=nil;next_=nil;}
-(BOOL)drained{return closing_&&!busy_;}
@end
