#import "DecodedFrameWindow.hpp"
#include "ReverseFrameCache.hpp"
#include "SourceClockTicks.hpp"
#include "DecodeAnchor.hpp"
#include "DiscardableAvcSample.hpp"
#import <AVFoundation/AVFoundation.h>
#import <VideoToolbox/VideoToolbox.h>
#import <QuartzCore/QuartzCore.h>
#include <atomic>
#include <condition_variable>
#include <deque>
#include <functional>
#include <map>
#include <mutex>
#include <vector>

namespace {
using Pixel = appleplayback::DecodedPixel;
using Frame = appleplayback::DecodedFrame;
enum Failure : NSInteger { None, Deadline, Tracks, Reader, Bound, Timing, Format, Decode, Coverage, Budget, SourceChanged };
struct Work {
  std::atomic<bool> cancelled{false};
  appleplayback::FrameBudget budget;
  uint64_t id, start, end;
  NSURL *__strong url;
  const std::string revision;
  double deadline;
  std::vector<Frame> frames;
  std::function<void(const std::vector<Frame> &)> progress;
  Failure failure = None;
  OSStatus decoderStatus = 0;
  NSError *__strong originalError = nil;
  Work(appleplayback::FrameBudget b, uint64_t i, uint64_t a, uint64_t z, NSURL *u, std::string r)
    : budget(std::move(b)), id(i), start(a), end(z), url(u), revision(std::move(r)), deadline(CACurrentMediaTime() + 5) {}
  bool expired() { return cancelled.load() || CACurrentMediaTime() >= deadline; }
};
struct TracksResult {
  std::mutex mutex; std::condition_variable changed;
  bool complete = false;
  NSArray<AVAssetTrack *> *__strong tracks = nil;
  NSError *__strong error = nil;
};
NSOperationQueue *workers() {
  static NSOperationQueue *queue = [] {
    auto q = [[NSOperationQueue alloc] init]; q.name = @"org.sportag.playback.decoded-window";
    q.maxConcurrentOperationCount = 2; return q;
  }(); return queue;
}
struct SampleTime { CMTime pts, duration; uint64_t start, end; bool wanted, called = false; };
void decoded(void *owner, void *reference, OSStatus status, VTDecodeInfoFlags flags,
             CVImageBufferRef image, CMTime pts, CMTime duration) {
  auto &work = *static_cast<Work *>(owner);
  auto *sample = static_cast<SampleTime *>(reference);
  if (!sample || sample->called) { work.failure = Timing; return; }
  sample->called = true;
  if (work.cancelled.load()) return;
  if (status) { work.failure = Decode; work.decoderStatus = status; return; }
  if (!sample->wanted) return;
  if (!image || (flags & (kVTDecodeInfo_FrameDropped | kVTDecodeInfo_Asynchronous))) {
    work.failure = Decode; return;
  }
  auto start = appleplayback::sourceTicks(pts), end = appleplayback::sourceTicks(CMTimeAdd(pts, duration));
  if (!start || !end || *start >= *end || *start != sample->start || *end != sample->end ||
      CMTimeCompare(pts, sample->pts) != 0 || CMTimeCompare(duration, sample->duration) != 0) { work.failure = Timing; return; }
  if (!appleplayback::sourceFileMatches(work.url, work.revision)) { work.failure = SourceChanged; return; }
  if (sample->end <= work.start || sample->start >= work.end) return;
  if (CVPixelBufferGetPixelFormatType(image) != kCVPixelFormatType_420YpCbCr8BiPlanarVideoRange ||
      CVPixelBufferGetPlaneCount(image) != 2 || !CVPixelBufferGetIOSurface(image) ||
      CVPixelBufferGetWidth(image) > 1920 || CVPixelBufferGetHeight(image) > 1080) {
    work.failure = Format; return;
  }
  if (work.frames.size() >= 64) { work.failure = Bound; return; }
  CVPixelBufferRetain(image);
  auto value = work.budget.retain(appleplayback::OwnedImage<Pixel>(image, [](Pixel *p) { CVPixelBufferRelease(p); }),
    work.id, 1, double(sample->start) / 120000, double(sample->end) / 120000,
    CVPixelBufferGetDataSize(image));
  if (!value) { work.failure = Budget; return; }
  work.frames.push_back(std::move(*value));
  if (work.progress) work.progress(work.frames);
}
void decode(NSURL *url, const std::shared_ptr<Work> &work) {
  @autoreleasepool {
    if (work->expired()) { work->failure = Deadline; return; }
    if (!appleplayback::sourceFileMatches(url, work->revision)) { work->failure = SourceChanged; return; }
    AVURLAsset *asset = [AVURLAsset URLAssetWithURL:url options:nil];
    auto loaded = std::make_shared<TracksResult>();
    [asset loadTracksWithMediaType:AVMediaTypeVideo completionHandler:^(NSArray<AVAssetTrack *> *tracks, NSError *error) {
      std::lock_guard<std::mutex> lock(loaded->mutex);
      loaded->tracks = tracks; loaded->error = error; loaded->complete = true; loaded->changed.notify_one();
    }];
    bool cancelledLoading = false; std::unique_lock<std::mutex> lock(loaded->mutex);
    while (!loaded->complete) {
      loaded->changed.wait_for(lock, std::chrono::milliseconds(10));
      if (!cancelledLoading && work->expired()) {
        cancelledLoading = true; lock.unlock(); [asset cancelLoading]; lock.lock();
      }
    }
    auto tracks = loaded->tracks; lock.unlock();
    if (work->expired()) { work->failure = Deadline; return; }
    if (tracks.count != 1 || loaded->error) { work->failure = Tracks; work->originalError = loaded->error; return; }
    NSError *error = nil;
    auto reader = [[AVAssetReader alloc] initWithAsset:asset error:&error];
    auto output = [[AVAssetReaderTrackOutput alloc] initWithTrack:tracks.firstObject outputSettings:nil];
    output.alwaysCopiesSampleData = NO;
    if (!reader || ![reader canAddOutput:output]) { work->failure = Reader; work->originalError = error; return; }
    [reader addOutput:output];
    // Start at the nearest bounded, verified full-sync sample. Arbitrary
    // padding can cross an extra GOP; keep it only as the unsupported-cursor
    // fallback. Actual sample/output timing and all read/decode bounds remain.
    const uint64_t from = work->start > 60000 ? work->start - 60000 : 0;
    const uint64_t to = std::min<uint64_t>(86400ULL * 120000, work->end + 60000);
    const CMTime anchor = appleplayback::decodeAnchor(tracks.firstObject, CMTimeMake(work->start, 120000),
      CMTimeMake(from, 120000), [work] { return work->expired(); });
    if (work->expired()) { work->failure = Deadline; return; }
    reader.timeRange = CMTimeRangeFromTimeToTime(anchor, CMTimeMake(to, 120000));
    if (![reader startReading]) { work->failure = Reader; work->originalError = reader.error; return; }
    VTDecompressionSessionRef session = nullptr;
    size_t samples = 0, bytes = 0;
    bool covered = false;
    std::deque<SampleTime> timings;
    @try {
      try {
        while (!work->expired() && !work->failure) {
          CMSampleBufferRef raw = [output copyNextSampleBuffer];
          if (!raw) break;
          auto release = std::unique_ptr<std::remove_pointer_t<CMSampleBufferRef>, void(*)(CMSampleBufferRef)>(raw, [](CMSampleBufferRef p) { CFRelease(p); });
          const auto size = CMSampleBufferGetTotalSampleSize(raw);
          const auto count = CMSampleBufferGetNumSamples(raw);
          if (++samples > 512 || size > 4ULL * 1024 * 1024 || bytes > 16ULL * 1024 * 1024 - size) { work->failure = Bound; break; }
          if (CMGetAttachment(raw, kCMSampleBufferAttachmentKey_SampleReferenceURL, nullptr)) { work->failure = Format; break; }
          if (!count && !size) {
            if (session && CMGetAttachment(raw, kCMSampleBufferAttachmentKey_ResetDecoderBeforeDecoding, nullptr) == kCFBooleanTrue) work->failure = Format;
            continue; // bounded non-image marker; explicit delayed-frame drain follows
          }
          bytes += size;
          if (count != 1 || !size) { work->failure = Format; break; }
          const CMTime originalPTS = CMSampleBufferGetPresentationTimeStamp(raw), originalDuration = CMSampleBufferGetDuration(raw);
          const CMTime outputPTS = CMSampleBufferGetOutputPresentationTimeStamp(raw), outputDuration = CMSampleBufferGetOutputDuration(raw);
          auto pts = appleplayback::sourceTicks(originalPTS), end = appleplayback::sourceTicks(CMTimeAdd(originalPTS, originalDuration));
          auto outPTS = appleplayback::sourceTicks(outputPTS), outEnd = appleplayback::sourceTicks(CMTimeAdd(outputPTS, outputDuration));
          if (!pts || !end || *pts >= *end || !outPTS || !outEnd || *outPTS >= *outEnd) { work->failure = Timing; break; }
          const bool wanted = *pts < work->end && *end > work->start;
          if (wanted && (CMTimeCompare(outputPTS, originalPTS) || CMTimeCompare(outputDuration, originalDuration))) {
            work->failure = Timing; break; // unsupported retiming/trim, not a tolerance fallback
          }
          auto format = CMSampleBufferGetFormatDescription(raw);
          if (!format) { work->failure = Format; break; }
          const auto dimensions = CMVideoFormatDescriptionGetDimensions(format);
          const auto codec = CMFormatDescriptionGetMediaSubType(format);
          if (dimensions.width <= 0 || dimensions.height <= 0 || dimensions.width > 1920 || dimensions.height > 1080 ||
              (codec != kCMVideoCodecType_H264 && codec != kCMVideoCodecType_JPEG)) { work->failure = Format; break; }

          const bool firstPicture = !session;
          if (firstPicture) {
            auto attachments = CMSampleBufferGetSampleAttachmentsArray(raw, false);
            auto dictionary = attachments && CFArrayGetCount(attachments) ? static_cast<CFDictionaryRef>(CFArrayGetValueAtIndex(attachments, 0)) : nullptr;
            if (dictionary && CFDictionaryGetValue(dictionary, kCMSampleAttachmentKey_NotSync) == kCFBooleanTrue) { work->failure = Format; break; }
            NSDictionary *attrs = @{(id)kCVPixelBufferPixelFormatTypeKey:@(kCVPixelFormatType_420YpCbCr8BiPlanarVideoRange), (id)kCVPixelBufferIOSurfacePropertiesKey:@{}};
            VTDecompressionOutputCallbackRecord callback{decoded, work.get()};
            work->decoderStatus = VTDecompressionSessionCreate(nullptr, format, nullptr, (__bridge CFDictionaryRef)attrs, &callback, &session);
            if (work->decoderStatus) { work->failure = Decode; break; }
          } else if (!VTDecompressionSessionCanAcceptFormatDescription(session, format)) { work->failure = Format; break; }
          // nal_ref_idc=0 pictures cannot reconstruct later references (RFC 6184
          // 5.3). Omit only unwanted picture-scoped AVC preroll, after the usual
          // anchor/session/format/timing checks; every requested picture decodes.
          if (!firstPicture && !wanted && appleplayback::discardableAvcSample(raw)) continue;
          timings.push_back({outputPTS, outputDuration, *outPTS, *outEnd, wanted});
          auto &timing = timings.back();
          // With both async and temporal flags clear, the SDK guarantees the
          // callback finishes before DecodeFrame returns. It is checked below.
          const OSStatus status = VTDecompressionSessionDecodeFrame(session, raw, 0, &timing, nullptr);
          if (status || !timing.called) { work->failure = Decode; work->decoderStatus = status; }
          if (!work->failure && !work->frames.empty()) {
            std::vector<std::pair<uint64_t, uint64_t>> ranges;
            for (const auto &frame : work->frames) ranges.emplace_back(
              uint64_t(llround(frame.pts() * 120000)), uint64_t(llround(frame.end() * 120000)));
            std::sort(ranges.begin(), ranges.end()); uint64_t cursor = work->start;
            for (const auto &range : ranges) {
              if (range.first > cursor) break;
              cursor = std::max(cursor, range.second);
            }
            if (cursor >= work->end) { covered = true; break; }
          }
        }
        if (!work->cancelled.load() && (work->expired() || (!covered && reader.status != AVAssetReaderStatusCompleted)))
          if (!work->failure) work->failure = work->expired() ? Deadline : Reader;
      } catch (const std::exception &) { work->failure = Bound; }
    } @catch (NSException *) { work->failure = Reader; }
    if (session) {
      const OSStatus finish = VTDecompressionSessionFinishDelayedFrames(session);
      const OSStatus drain = VTDecompressionSessionWaitForAsynchronousFrames(session);
      if (!work->failure && (finish || drain)) { work->failure = Decode; work->decoderStatus = finish ?: drain; }
      VTDecompressionSessionInvalidate(session); CFRelease(session);
    }
    if (reader.status == AVAssetReaderStatusFailed) work->originalError = reader.error;
    [reader cancelReading];
    if (work->cancelled.load()) { work->frames.clear(); return; }
    std::sort(work->frames.begin(), work->frames.end(), [](const Frame &a, const Frame &b) { return a.pts() < b.pts(); });
    if (!work->failure && work->frames.empty()) work->failure = Coverage;
    if (!work->failure && !appleplayback::sourceFileMatches(url, work->revision)) work->failure = SourceChanged;
    if (work->failure) work->frames.clear();
  }
}
}

@implementation STDecodedFrameWindow {
  NSURL *_url;
  std::string _revision;
  std::optional<appleplayback::FrameBudget> _budget;
  appleplayback::ReverseFrameCache<Pixel> _cache;
  appleplayback::ReverseFrameCache<Pixel> _previousCache;
  std::shared_ptr<Work> _work;
  uint64_t _request, _previousRequest;
  BOOL _closed, _failed, _busy, _hasCache;
  NSError *_error;
}
- (instancetype)initWithURL:(NSURL *)url budget:(appleplayback::FrameBudget)budget sourceRevision:(std::string)revision {
  NSParameterAssert(NSThread.isMainThread && url.isFileURL);
  if ((self = [super init])) { _url = [url copy]; _revision = std::move(revision); _budget.emplace(std::move(budget)); }
  return self;
}
- (BOOL)requestStart:(uint64_t)start end:(uint64_t)end {
  NSParameterAssert(NSThread.isMainThread);
  if (_closed || _failed || _busy || start >= end || end > 86400ULL * 120000 || end - start > 120000 || _request == 9007199254740991ULL) return NO;
  if (_hasCache) {
    _previousCache = std::move(_cache); _previousRequest = _request;
  }
  _cache = {}; _hasCache = NO;
  ++_request; _cache.beginRequest(_request, 1); _busy = YES;
  auto work = std::make_shared<Work>(*_budget, _request, start, end, _url, _revision); _work = work;
  NSURL *url = _url;
  std::weak_ptr<Work> weak = work;
  work->progress = [self, weak](const std::vector<Frame> &frames) {
    auto snapshot = std::make_shared<std::vector<Frame>>(frames);
    std::sort(snapshot->begin(), snapshot->end(), [](const Frame &a, const Frame &b) { return a.pts() < b.pts(); });
    // At most 64 immutable snapshots per job. They share the original image
    // leases/charge; late snapshots never publish into a new request/source.
    dispatch_async(dispatch_get_main_queue(), ^{
      auto active = weak.lock();
      if (!active || self->_work != active || self->_closed || self->_failed || active->cancelled.load()) {
        // Dispatch may retain its block beyond this callback. Drop its image
        // loans now, before the later physical-drain callback can complete.
        snapshot->clear(); return;
      }
      if (!appleplayback::sourceFileMatches(active->url, active->revision)) {
        self->_failed = YES; active->cancelled.store(true);
        self->_error = [NSError errorWithDomain:@"SportagDecodeWindow" code:SourceChanged userInfo:nil];
        snapshot->clear(); return;
      }
      if (!self->_cache.publish(std::move(*snapshot))) {
        self->_failed = YES; active->cancelled.store(true);
        self->_error = [NSError errorWithDomain:@"SportagDecodeWindow" code:Timing userInfo:nil];
      } else self->_hasCache = YES;
    });
  };
  [workers() addOperationWithBlock:^{
    @try {
      try { decode(url, work); }
      catch (const std::exception &) { work->failure = Bound; }
    } @catch (NSException *) { work->failure = Reader; }
    dispatch_async(dispatch_get_main_queue(), ^{
      work->progress = {};
      if (self->_work != work) { work->frames.clear(); return; }
      self->_work.reset();
      if (self->_closed || work->cancelled.load()) {
        work->frames.clear(); self->_busy = NO; return;
      }
      // A replacement can make AVAssetReader fail before it reaches the
      // worker's final identity check. Classify the observed replacement at
      // the adoption boundary, retaining any reader error as the cause.
      if (!appleplayback::sourceFileMatches(work->url, work->revision)) work->failure = SourceChanged;
      if (!work->failure && CACurrentMediaTime() >= work->deadline) work->failure = Deadline;
      if (!work->failure && !self->_cache.publish(std::move(work->frames))) work->failure = Timing;
      if (!work->failure) self->_hasCache = YES;
      if (work->failure) {
        self->_failed = YES;
        NSError *underlying = work->originalError ?: (work->decoderStatus ?
          [NSError errorWithDomain:NSOSStatusErrorDomain code:work->decoderStatus userInfo:nil] : nil);
        self->_error = [NSError errorWithDomain:@"SportagDecodeWindow" code:work->failure
          userInfo:underlying ? @{NSUnderlyingErrorKey:underlying} : nil];
        self->_cache.clear();
      }
      work->frames.clear(); self->_busy = NO;
    });
  }];
  return YES;
}
- (BOOL)sourceCurrent {
  NSParameterAssert(NSThread.isMainThread);
  if (_closed || self.failed) return NO;
  if (!appleplayback::sourceFileMatches(_url, _revision)) {
    _failed = YES; [self invalidate]; _cache.clear(); _previousCache.clear(); _hasCache = NO;
    _error = [NSError errorWithDomain:@"SportagDecodeWindow" code:SourceChanged userInfo:nil];
    return NO;
  }
  return YES;
}
- (std::optional<Frame>)select:(uint64_t)time {
  NSParameterAssert(NSThread.isMainThread);
  if (![self sourceCurrent]) return std::nullopt;
  auto frame = _cache.select(double(time) / 120000, _request);
  return frame ? frame : _previousCache.select(double(time) / 120000, _previousRequest);
}
- (void)invalidate {
  NSParameterAssert(NSThread.isMainThread);
  if (_work) _work->cancelled.store(true);
}
- (void)close { [self invalidate]; _closed = YES; _cache.clear(); _previousCache.clear(); _hasCache = NO; }
- (BOOL)failed { return _failed || (!_closed && _work && !_work->cancelled.load() && CACurrentMediaTime() >= _work->deadline); }
- (BOOL)drained { return !_busy; }
- (NSError *)error { return _error ?: (self.failed ? [NSError errorWithDomain:@"SportagDecodeWindow" code:Deadline userInfo:nil] : nil); }
@end
