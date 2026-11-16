#pragma once
#import <Foundation/Foundation.h>
#include <cstdint>
#include <optional>

namespace appleplayback {
struct SourceSampleInterval { uint64_t start, end; };
}

NS_ASSUME_NONNULL_BEGIN
/// Main-actor metadata index, not a decoder or a playback clock. A compressed
/// track reader supplies actual sample intervals for AVPlayer output PTS. No
/// duration is guessed from average fps; a missing interval is not ready.
@interface STSourceSampleIntervals : NSObject
- (instancetype)initWithURL:(NSURL *)url;
- (std::optional<appleplayback::SourceSampleInterval>)lookup:(uint64_t)pts;
/// At most one bounded scan per source. Returns NO when cached/busy/closed/failed.
- (BOOL)request:(uint64_t)pts;
/// A deadline can fail while drained remains NO. Never equate the two.
@property(nonatomic, readonly) BOOL failed;
@property(nonatomic, readonly) BOOL drained;
/// Invalidates publication immediately. Already-running reads must still drain.
- (void)cancel;
@end
NS_ASSUME_NONNULL_END
