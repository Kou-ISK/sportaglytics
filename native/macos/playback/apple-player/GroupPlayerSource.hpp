#pragma once
#import "ApplePlayerSession.hpp"
#import "DecodedFrameWindow.hpp"
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
/// Pixels and sample intervals come from the same compressed sample and VT
/// callback. AVPlayer supplies audio/control only; no display deadline is used
/// as original-image provenance.
/// The shared budget includes decoded image banks and transport loans, not decoder
/// internals or an OS memory reservation. Main-thread confined.
@interface STGroupPlayerSource : NSObject
- (instancetype)initWithURL:(NSURL *)url
               globalStart:(uint64_t)start globalEnd:(uint64_t)end
              sourceOffset:(int64_t)offset budget:(appleplayback::FrameBudget)budget
            sourceRevision:(std::string)revision;
/// Internal dependency seam for native lifecycle tests. The regular group Host
/// always constructs its own session for Main's qualified URL.
- (instancetype)initWithURL:(NSURL *)url
               globalStart:(uint64_t)start globalEnd:(uint64_t)end
              sourceOffset:(int64_t)offset budget:(appleplayback::FrameBudget)budget
            sourceRevision:(std::string)revision audioSession:(STApplePlayerSession *)audio;
/// New commands revoke callbacks/images, not other sources. Must increase.
- (BOOL)seek:(uint64_t)globalTicks operation:(uint64_t)operation;
/// Internal publication pins: at most four recent successful pair publications,
/// sharing the existing image charge. No caller-supplied pixels are accepted.
- (BOOL)rememberPublishedPair:(uint64_t)pair;
- (BOOL)hasPublishedPair:(uint64_t)pair covering:(uint64_t)globalTicks;
/// Called only after the group sender validates the exact complete stop proof.
/// Audio readiness and physical worker drainage remain separate requirements.
- (BOOL)seek:(uint64_t)globalTicks operation:(uint64_t)operation publishedPair:(uint64_t)pair;
/// Same source/physical seek, new control owner. Completed immutable samples
/// remain usable; this never grants a different seek or source epoch.
- (BOOL)adoptOperation:(uint64_t)operation;
- (void)poll;
- (void)pollAtGlobalTime:(uint64_t)ticks;
- (std::optional<appleplayback::GroupSourceFrame>)frame;
- (BOOL)scheduleRate:(float)rate globalTicks:(uint64_t)ticks hostTime:(CMTime)hostTime;
- (BOOL)selectAudioTrack:(NSUInteger)track volume:(float)volume muted:(BOOL)muted;
- (void)silence;
/// Stop audio output for a fixed-target refill, preserving decode direction.
/// Explicit pause/seek/close still revoke further prefetch.
- (void)pauseForRefill;
- (void)pause;
- (void)close;
@property(nonatomic, readonly) BOOL failed;
/// Actual bounded image worker state, distinct from source readiness/close.
@property(nonatomic, readonly) BOOL imageReadInProgress;
@property(nonatomic, readonly) BOOL drained;
@property(nonatomic, readonly) BOOL seekCompleted;
@property(nonatomic, readonly, nullable) NSError *error;
@end
NS_ASSUME_NONNULL_END
