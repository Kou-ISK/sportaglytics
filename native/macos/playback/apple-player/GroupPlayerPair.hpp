#pragma once
#import "GroupPlayerSource.hpp"
#include "../surface-transport/GroupSurfaceSender.hpp"
#include <array>

namespace appleplayback {
struct GroupClipPlacement {
  uint64_t sourceIndex, sourceEpoch, globalStart, globalEnd;
  int64_t sourceOffset;
};
struct GroupPairOwner { uint64_t operation, seek, pair, globalTicks; };
}
NS_ASSUME_NONNULL_BEGIN
/// Experimental Host-side pair publication. Both matched metadata intervals
/// must cover the common anchor before either send is attempted. An AVPlayer
/// display-deadline match is not general original-pixel provenance, a canvas
/// ACK, or a promise of continuous decoder supply. All methods are main-thread only.
@interface STGroupPlayerPair : NSObject
- (instancetype)initWithURLs:(NSArray<NSURL *> *)urls
                 placements:(std::array<appleplayback::GroupClipPlacement, 2>)placements
                     budget:(appleplayback::FrameBudget)budget;
- (BOOL)seek:(uint64_t)globalTicks operation:(uint64_t)operation;
- (BOOL)adoptOperation:(uint64_t)operation;
- (void)poll;
/// Nearest anchor in the intersection of both real sample intervals. This is
/// measured image availability, not the requested/playback clock.
- (std::optional<uint64_t>)availableAnchor:(uint64_t)desired;
/// Returns NO while either image/metadata is missing or credits are full.
/// Exceptions from sendPair preserve the partial/unknown delivery outcome;
/// callers must stop/drain, never retry the same pair.
- (BOOL)publish:(appleplayback::GroupPairOwner)owner sender:(GroupSurfaceSender &)sender;
/// A common start is scheduled only after both actual frames cover the anchor.
/// Partial scheduling pauses both members, so one source never keeps running.
- (BOOL)scheduleRate:(float)rate globalTicks:(uint64_t)ticks hostTime:(CMTime)hostTime;
- (BOOL)selectAudioAngle:(NSUInteger)angle track:(NSUInteger)track
                 volume:(float)volume muted:(BOOL)muted;
- (std::optional<float>)observedRate;
- (void)pause;
- (void)close;
@property(nonatomic, readonly) BOOL failed;
@property(nonatomic, readonly) BOOL drained;
@property(nonatomic, readonly, nullable) NSError *error;
@end
NS_ASSUME_NONNULL_END
