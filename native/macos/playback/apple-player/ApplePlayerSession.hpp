#pragma once
#import <AVFoundation/AVFoundation.h>

NS_ASSUME_NONNULL_BEGIN
/// AVPlayer owns media reading, decoding, audio rendering and the source clock.
/// The caller only transfers the image selected by that clock to its UI surface.
/// All methods run on the main thread. No decoded-frame or audio supply queue.
@interface STApplePlayerSession : NSObject
- (instancetype)initWithURL:(NSURL *)url;
@property(nonatomic, readonly) AVPlayerItemStatus status;
@property(nonatomic, readonly, nullable) NSError *error;
@property(nonatomic, readonly) CMTime duration;
@property(nonatomic, readonly) CMTime currentTime;
@property(nonatomic, readonly) float rate;
@property(nonatomic, readonly) AVPlayerTimeControlStatus timeControlStatus;
@property(nonatomic, readonly) NSUInteger audioTrackCount;
- (BOOL)selectAudioTrack:(NSUInteger)index;
- (BOOL)supportsRate:(float)rate;
- (void)setVolume:(float)volume muted:(BOOL)muted;
- (void)setRate:(float)rate;
/// Schedule a ready, seek-settled source on the shared host clock. This does not
/// establish a group ready barrier, guarantee decoded data, or confirm display.
/// A future host anchor is not a delayed-action timer: the AVPlayer timebase may
/// run before it. The group must gate publication against its canonical clock.
/// The caller must pause all members if any member rejects the same operation.
- (BOOL)scheduleRate:(float)rate fromTime:(CMTime)time atHostTime:(CMTime)hostTime;
- (void)pause;
/// approximate is only for transient scrubbing. The returned position must not
/// be reported as an exact requested time or used to mutate annotation ranges.
- (void)seekToTime:(CMTime)time approximate:(BOOL)approximate
        completion:(void (^)(BOOL finished))completion;
/// One owned correction after a stale stopped image: refresh the output queue
/// and seek to the actual paused clock. Completion still requires PTS/display
/// validation by the caller. Never use this while playing or already seeking.
- (void)settleStoppedImageAtTime:(CMTime)time
                    completion:(void (^)(BOOL finished))completion;
- (nullable CVPixelBufferRef)copyCurrentImage:(CMTime *)presentationTime
                                    force:(BOOL)force CF_RETURNS_RETAINED;
- (void)close;
@end
NS_ASSUME_NONNULL_END
