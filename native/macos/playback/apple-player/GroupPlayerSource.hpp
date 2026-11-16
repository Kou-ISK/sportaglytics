#pragma once
#import "ApplePlayerSession.hpp"
#import "SourceSampleIntervals.hpp"
#include "../frame-ownership/FrameLease.hpp"
#include <optional>
#include <type_traits>

namespace appleplayback {
using GroupPixel = std::remove_pointer_t<CVPixelBufferRef>;
struct GroupSourceFrame {
  RetainedImage<GroupPixel> image;
  uint64_t sourceStart, sourceEnd, globalStart, globalEnd;
  bool covers(uint64_t time) const { return globalStart <= time && time < globalEnd; }
};
}
NS_ASSUME_NONNULL_BEGIN
/// One active clip of a group Host. Main owns clip placement/qualification.
/// The AVPlayer display deadline is matched exactly to compressed sample
/// metadata before experimental publication. The API does not promise that all
/// deadlines are source sample PTS; unmatched deadlines fail closed. This is
/// not a general source-frame provenance proof or a production capability.
/// The shared budget includes pending metadata and transport loans, not decoder
/// internals or an OS memory reservation. Main-thread confined.
@interface STGroupPlayerSource : NSObject
- (instancetype)initWithURL:(NSURL *)url
               globalStart:(uint64_t)start globalEnd:(uint64_t)end
              sourceOffset:(int64_t)offset budget:(appleplayback::FrameBudget)budget;
/// New commands revoke callbacks/images, not other sources. Must increase.
- (BOOL)seek:(uint64_t)globalTicks operation:(uint64_t)operation;
/// Same source/physical seek, new control owner. Completed immutable samples
/// remain usable; this never grants a different seek or source epoch.
- (BOOL)adoptOperation:(uint64_t)operation;
- (void)poll;
- (std::optional<appleplayback::GroupSourceFrame>)frame;
- (BOOL)scheduleRate:(float)rate globalTicks:(uint64_t)ticks hostTime:(CMTime)hostTime;
- (BOOL)selectAudioTrack:(NSUInteger)track volume:(float)volume muted:(BOOL)muted;
- (std::optional<float>)observedRate;
- (void)silence;
- (void)pause;
- (void)close;
@property(nonatomic, readonly) BOOL failed;
@property(nonatomic, readonly) BOOL drained;
@property(nonatomic, readonly) BOOL seekCompleted;
@property(nonatomic, readonly, nullable) NSError *error;
@end
NS_ASSUME_NONNULL_END
