#pragma once
#import "NativeSupport.hpp"
#include <cmath>

// Read-only observations of the framework-owned timebase. Never set a source
// clock or modify the synchronizer's read-only timebase directly.
inline NSDictionary* nativeClockSnapshot(AVSampleBufferRenderSynchronizer* sync) {
 if(!sync || !sync.timebase) return @{@"available":@NO};
 CMTime time=kCMTimeInvalid;Float64 rate=0;
 OSStatus status=CMTimebaseGetTimeAndRate(sync.timebase,&time,&rate);
 CMClockRef host=CMClockGetHostTimeClock();
 CMTime hostNow=CMClockGetTime(host),mediaAnchor=kCMTimeInvalid,hostAnchor=kCMTimeInvalid;
 Float64 relative=0;OSStatus anchorStatus=CMSyncGetRelativeRateAndAnchorTime(sync.timebase,host,&relative,&mediaAnchor,&hostAnchor);
 CMClockRef source=CMTimebaseCopyUltimateSourceClock(sync.timebase);
 BOOL sourceIsHost=source&&CFEqual(source,host);
 if(source)CFRelease(source);
 return @{@"available":@YES,@"auxiliaryReadsAtomic":@NO,@"status":@(status),@"time":timeJSON(time),@"rate":std::isfinite(rate)?@(rate):[NSNull null],
          @"requestedRateProperty":@(sync.rate),@"hostNow":timeJSON(hostNow),@"anchorStatus":@(anchorStatus),
          @"relativeToHostRate":std::isfinite(relative)?@(relative):[NSNull null],
          @"mediaAnchor":timeJSON(mediaAnchor),@"hostAnchor":timeJSON(hostAnchor),@"sourceClockIsHost":@(sourceIsHost)};
}
inline bool applyNativeClock(AVSampleBufferRenderSynchronizer* sync,double rate,CMTime time,CMTime host) {
 if(!sync || !sync.timebase) return false;
 if(CMTIME_IS_NUMERIC(host)) [sync setRate:rate time:time atHostTime:host];
 else [sync setRate:rate time:time];
 return true;
}
