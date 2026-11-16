#pragma once
#import <Foundation/Foundation.h>
#import <CoreVideo/CoreVideo.h>
#include "../frame-ownership/FrameLease.hpp"
#include "SourceFileRevision.hpp"
#include <optional>
#include <type_traits>

namespace appleplayback {
using DecodedPixel = std::remove_pointer_t<CVPixelBufferRef>;
using DecodedFrame = RetainedFrame<DecodedPixel>;
}
NS_ASSUME_NONNULL_BEGIN
/// Main-actor owner of one bounded compressed-reader/VT decode request. Pixel
/// timestamps come from the same CMSampleBuffer passed to the decoder, never an
/// AVPlayer display deadline. Existing loans retain their shared budget charge.
@interface STDecodedFrameWindow : NSObject
- (instancetype)initWithURL:(NSURL *)url budget:(appleplayback::FrameBudget)budget sourceRevision:(std::string)revision;
/// One request per owner. New commands must invalidate and await the old worker
/// before requesting another window. Completed immutable images may be reused.
- (BOOL)requestStart:(uint64_t)start end:(uint64_t)end;
- (std::optional<appleplayback::DecodedFrame>)select:(uint64_t)sourceTime;
- (void)invalidate;
- (void)close;
@property(nonatomic, readonly) BOOL failed;
@property(nonatomic, readonly) BOOL drained;
@property(nonatomic, readonly, nullable) NSError *error;
@end
NS_ASSUME_NONNULL_END
