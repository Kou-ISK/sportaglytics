#import "PCMWindowSupply.hpp"
#include "PCMWindowPolicy.hpp"
#include <cstdio>
#include <stdexcept>

// Exercise the production owner/pump/cancellation code without media or audio output.
@implementation AudioPrefix
+(AudioPrefix*)load:(NSDictionary*)manifest window:(NSDictionary*)window
    cancel:(std::atomic<bool>*)cancel log:(EventLog*)log {
  @throw [NSException exceptionWithName:@"UnexpectedRealReader" reason:nil userInfo:nil];
}
@end
@interface PCMWindowSupply (Testing)
-(AudioPrefix*)loadWindow:(NSDictionary*)proof cancel:(std::atomic<bool>*)cancel;
@end
static std::atomic<int> live{0}, loads{0};
static std::atomic<bool> blocked{false}, overlap{false};
@interface ControlledSupply : PCMWindowSupply
@end
@implementation ControlledSupply
-(AudioPrefix*)loadWindow:(NSDictionary*)proof cancel:(std::atomic<bool>*)cancel {
  int active=++live;
  if(active>1) overlap.store(true);
  ++loads;
  while(blocked.load()&&!cancel->load()) [NSThread sleepForTimeInterval:.001];
  // Return a result even after cancellation, so acceptance must reject stale epochs.
  AudioPrefix*p=[AudioPrefix new];
  p.startSample=[proof[@"start"]longLongValue];
  p.endSample=[proof[@"end"]longLongValue];
  NSMutableArray*tracks=[NSMutableArray array];
  for(unsigned track=0;track<3;track++) {
    NSMutableArray*samples=[NSMutableArray array];
    for(int64_t pos=p.startSample;pos<p.endSample;pos+=pcmwindow::Chunk)
      [samples addObject:@[@(track),@(pos)]];
    [tracks addObject:samples];
  }
  p.tracks=tracks;
  --live;
  return p;
}
@end
static void check(bool value,const char*reason) {
  if(!value) throw std::runtime_error(reason);
}
static void until(bool(^done)(),const char*reason) {
  double deadline=mono()+3;
  while(!done()&&mono()<deadline)
    [NSRunLoop.currentRunLoop runUntilDate:[NSDate dateWithTimeIntervalSinceNow:.002]];
  check(done(),reason);
}
static void boundary(ControlledSupply*s,int64_t sample) {
  for(unsigned track=0;track<3;track++) {
    NSArray*value=[s bufferForTrack:track sample:sample];
    check(value.count==2&&[value[0]unsignedIntValue]==track&&
          [value[1]longLongValue]==sample,"three-track boundary and original time");
  }
}
int main() { @autoreleasepool { try {
  const int64_t first=0, step=pcmwindow::MaxWindow, end=step*4-2048;
  NSDictionary*manifest=@{@"rollingPCM":@YES,@"pcmStart":@(first),@"pcmEnd":@(end),
    @"pcmTracks":@[@1,@2,@3],@"layoutSHA":@"synthetic"};
  __block int accepted=0;
  __block NSString*error=nil;
  ControlledSupply*s=[[ControlledSupply alloc]initWithManifest:manifest log:[EventLog new]
    ready:^(NSString*value){++accepted;error=value;}];
  [s selectSample:first];
  until(^bool{return accepted==1;},"initial window");
  [s prefetchAt:first playing:NO];
  check(loads.load()==1,"paused distant boundary must not read");
  blocked.store(true);
  [s prefetchAt:first playing:YES];
  until(^bool{return live.load()==1;},"play must read adjacent window immediately");
  for(int i=0;i<100;i++) [s prefetchAt:first playing:YES];
  [s selectSample:1024];
  check(loads.load()==2,"repeated ticks and current-window seek reuse one reader");
  blocked.store(false);
  until(^bool{return accepted==2;},"adjacent window ready");
  boundary(s,step);
  // The renderer has enqueued audio 1.2s ahead of its source clock.
  const int64_t clock=step-pcmwindow::PrerollSamples;
  [s prefetchAt:clock playing:NO];
  check(loads.load()==2,"paused early promotion must not read distant window");
  blocked.store(true);
  [s prefetchAt:clock playing:YES];
  until(^bool{return live.load()==1;},"playing early promotion must use free next slot");
  blocked.store(false);
  until(^bool{return accepted==3;},"early adjacent read accepted");
  boundary(s,2*step);
  [s prefetchAt:3*step-pcmwindow::PrefetchSamples-1 playing:NO];
  check(loads.load()==3,"paused 86401-sample boundary retains threshold");
  blocked.store(true);
  [s prefetchAt:3*step-pcmwindow::PrefetchSamples playing:NO];
  until(^bool{return live.load()==1;},"paused 86400-sample boundary reads");
  [s selectSample:first];
  blocked.store(false);
  until(^bool{return [s covers:first];},"seek replaces cancelled adjacent read");
  check(accepted==4&&!error&&! [s covers:3*step],"stale completion rejected");
  [s selectSample:3*step];
  until(^bool{return [s covers:3*step];},"terminal partial window");
  boundary(s,3*step);
  int terminalLoads=loads.load();
  for(int i=0;i<100;i++) [s prefetchAt:end-1 playing:YES];
  check(loads.load()==terminalLoads,"no read past source end");
  [s selectSample:first];
  until(^bool{return [s covers:first];},"return to first window");
  blocked.store(true);
  [s prefetchAt:first playing:YES];
  until(^bool{return live.load()==1;},"close with reader pending");
  int beforeClose=accepted;
  [s close];
  until(^bool{return s.drained;},"cancelled reader drains on close");
  check(accepted==beforeClose&&! [s covers:first]&&!overlap.load()&&!error,
        "close rejects stale result and maintains single-reader bound");
  puts("PASS: immediate bounded play prefetch, paused threshold, three tracks, seek/close epochs, terminal window");
  return 0;
} catch(const std::exception&e) {fprintf(stderr,"FAIL: %s\n",e.what());return 1;} } }
