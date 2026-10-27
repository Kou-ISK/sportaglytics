#import "AACWindow.hpp"
#include "PCMWindowPolicy.hpp"
@implementation AudioPrefix
+(AudioPrefix*)load:(NSDictionary*)manifest window:(NSDictionary*)window cancel:(std::atomic<bool>*)cancel log:(EventLog*)log {
 double began = mono(), deadline = began + 5;
 localaac::check(cancel, deadline);
 int64_t start = [window[@"start"] longLongValue], end = [window[@"end"] longLongValue];
 int64_t readStart = MAX([manifest[@"pcmStart"] longLongValue], start - 48000);
 try {
  nativeplayback::AudioTimeline timeline([manifest[@"pcmStart"] longLongValue], [manifest[@"pcmEnd"] longLongValue]);
  require(timeline.validWindow(start, end) && readStart >= 0 && [window[@"tracks"] count] == 3, @"bounded source range");
 } catch (const std::exception& error) { require(false, [NSString stringWithUTF8String:error.what()]); }
 require([manifest[@"evidenceMode"] isEqualToString:@"original-observation-v1"], @"original audio evidence mode");
 for (NSUInteger t = 0; t < 3; t++) require([window[@"tracks"][t][@"trackID"] intValue] == t + 2, @"source audio track identity");
 [log add:@"original-PCM-open-begin" values:@{@"source":manifest[@"source"], @"windowStart":@(start), @"windowEnd":@(end)}];
 NSMutableArray* bytes = [NSMutableArray new];
 CMAudioFormatDescriptionRef format = nullptr;
 @try {
  @autoreleasepool {
   NSArray* formats=nil;
   try {
    auto input=finiteaac::read([manifest[@"source"] fileSystemRepresentation],readStart,end,*cancel,[manifest[@"pcmEnd"] longLongValue],deadline);
    AVURLAsset* asset=[AVURLAsset URLAssetWithURL:[NSURL fileURLWithPath:manifest[@"source"]]options:@{AVURLAssetPreferPreciseDurationAndTimingKey:@YES}];
    auto sourceTracks=[asset tracksWithMediaType:AVMediaTypeAudio];require(sourceTracks.count==3,@"all original audio formats");
    NSMutableArray* found=[NSMutableArray new];
    for(NSUInteger t=0;t<3;t++){
     localaac::check(cancel,deadline);require(sourceTracks[t].trackID==t+2,@"source format track identity");
     NSArray* descriptions=sourceTracks[t].formatDescriptions;require(descriptions.count==1,@"single source format");
     auto description=(__bridge CMAudioFormatDescriptionRef)descriptions[0];localaac::validateFormat(description,window[@"layoutSHA"]);localaac::validateCookie(description,input.tracks[t].extra);
     [found addObject:descriptions[0]];
     [bytes addObject:localaac::decodeWindow(input.tracks[t],description,readStart,start,end,window[@"layoutSHA"],cancel,deadline)];
    }
    formats=found;
   }catch(const std::exception&error){require(false,[NSString stringWithUTF8String:error.what()]);}
   require(formats.count==3,@"all source audio formats retained");
   auto sourceFormat=(__bridge CMAudioFormatDescriptionRef)formats[0];
   size_t layoutSize = 0; const auto* layout = CMAudioFormatDescriptionGetChannelLayout(sourceFormat, &layoutSize);
   AudioStreamBasicDescription output{48000, kAudioFormatLinearPCM, 9, 8, 1, 8, 2, 32, 0};
   require(CMAudioFormatDescriptionCreate(kCFAllocatorDefault, &output, layoutSize, layout, 0, nullptr, nullptr, &format) == noErr, @"PCM output format");
  }
  NSMutableArray* tracks = [NSMutableArray new];
  for (NSUInteger t = 0; t < 3; t++) {
   NSData* data = bytes[t];
   NSString* observedSHA = (![manifest[@"rollingPCM"] boolValue] || [manifest[@"tracePlayback"] boolValue]) ? hashBytes(data.bytes, data.length) : nil;
   NSMutableArray* samples = [NSMutableArray new];
   for (int64_t pos = start; pos < end; pos += 1024) {
    localaac::check(cancel, deadline);
    int64_t count = MIN(static_cast<int64_t>(1024), end - pos); size_t length = count * 8;
    CMBlockBufferRef block = nullptr; CMSampleBufferRef buffer = nullptr;
    @try {
     require(CMBlockBufferCreateWithMemoryBlock(kCFAllocatorDefault, nullptr, length, kCFAllocatorDefault, nullptr, 0, length, 0, &block) == noErr, @"PCM sample allocation");
     require(CMBlockBufferReplaceDataBytes(static_cast<const char*>(data.bytes) + (pos - start) * 8, block, 0, length) == noErr, @"PCM sample copy");
     CMSampleTimingInfo timing{CMTimeMake(1, 48000), CMTimeMake(pos, 48000), kCMTimeInvalid}; size_t frameBytes = 8;
     require(CMSampleBufferCreateReady(kCFAllocatorDefault, block, format, count, 1, &timing, 1, &frameBytes, &buffer) == noErr, @"PCM timed sample");
     [samples addObject:(__bridge id)buffer];
    } @finally { if (buffer) CFRelease(buffer); if (block) CFRelease(block); }
   }
   [tracks addObject:samples];
   [log add:@"observed-PCM-window-loaded" values:@{@"track":@(t), @"sha256":observedSHA ?: [NSNull null], @"independentReferenceCompared":@NO, @"startSample":@(start), @"endSample":@(end), @"buffers":@(samples.count), @"predecodedWindowOnly":@NO, @"decodedFromSourceThisRun":@YES, @"seconds":@(mono()-began)}];
  }
  localaac::check(cancel, deadline);
  AudioPrefix* prefix = [AudioPrefix new]; prefix.startSample = start; prefix.endSample = end; prefix.tracks = tracks; prefix.markers = @[@[], @[], @[]]; prefix.proof = window[@"tracks"];
  return prefix;
 } @finally { if (format) CFRelease(format); }
}
@end
