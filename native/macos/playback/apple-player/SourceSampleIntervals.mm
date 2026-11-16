#import "SourceSampleIntervals.hpp"
#include "SourceClockTicks.hpp"
#import <AVFoundation/AVFoundation.h>
#import <QuartzCore/QuartzCore.h>
#include <atomic>
#include <chrono>
#include <condition_variable>
#include <map>
#include <memory>
#include <mutex>

namespace {
using Failure = appleplayback::SourceSampleFailure;
using Interval = appleplayback::SourceSampleInterval;
struct Request {
  std::atomic<bool> cancelled{false};
  std::map<uint64_t, Interval> intervals;
  appleplayback::SourceSampleFailure failure = appleplayback::SourceSampleFailure::None;
  double deadline = 0;
};
struct Tracks {
  std::mutex mutex;
  std::condition_variable changed;
  bool complete = false;
  NSArray<AVAssetTrack*>* __strong values = nil;
};
dispatch_queue_t metadataQueue() {
  static dispatch_queue_t queue = dispatch_queue_create("org.sportag.playback.sample-metadata", DISPATCH_QUEUE_SERIAL);
  return queue;
}
void scan(NSURL* url, uint64_t pts, const std::shared_ptr<Request>& request) {
  @autoreleasepool {
    if (request->cancelled.load()) return;
    const double deadline = request->deadline;
    if (CACurrentMediaTime() >= deadline) { request->failure = Failure::Deadline; return; }
    auto asset = [AVURLAsset URLAssetWithURL:url options:nil];
    auto loaded = std::make_shared<Tracks>();
    [asset loadTracksWithMediaType:AVMediaTypeVideo completionHandler:^(NSArray<AVAssetTrack*>* tracks, NSError*) {
      std::lock_guard<std::mutex> lock(loaded->mutex);
      loaded->values = tracks; loaded->complete = true; loaded->changed.notify_one();
    }];
    bool loadingCancelled = false;
    std::unique_lock<std::mutex> lock(loaded->mutex);
    while (!loaded->complete) {
      loaded->changed.wait_for(lock, std::chrono::milliseconds(10));
      if (!loadingCancelled && (request->cancelled.load() || CACurrentMediaTime() >= deadline)) {
        loadingCancelled = true;
        // cancelLoading may invoke completion synchronously. Do not hold the
        // callback's mutex, and do not claim drainage before it actually returns.
        lock.unlock(); [asset cancelLoading]; lock.lock();
      }
    }
    NSArray<AVAssetTrack*>* tracks = loaded->values;
    lock.unlock();
    if (request->cancelled.load()) return;
    if (tracks.count != 1 || CACurrentMediaTime() >= deadline) { request->failure = CACurrentMediaTime() >= deadline ? Failure::Deadline : Failure::Tracks; return; }
    NSError* error = nil;
    auto reader = [[AVAssetReader alloc] initWithAsset:asset error:&error];
    auto output = [[AVAssetReaderTrackOutput alloc] initWithTrack:tracks.firstObject outputSettings:nil];
    output.alwaysCopiesSampleData = NO;
    if (!reader || ![reader canAddOutput:output]) { request->failure = Failure::ReaderSetup; return; }
    [reader addOutput:output];
    const uint64_t start = pts > 12000 ? pts - 12000 : 0;
    reader.timeRange = CMTimeRangeMake(CMTimeMake(start, 120000), CMTimeMake(120000, 120000));
    if (![reader startReading]) { request->failure = Failure::StartReading; return; }
    size_t samples = 0, bytes = 0;
    while (!request->cancelled.load() && CACurrentMediaTime() < deadline) {
      CMSampleBufferRef sample = [output copyNextSampleBuffer];
      if (!sample) break;
      const auto begin = appleplayback::sourceTicks(CMSampleBufferGetOutputPresentationTimeStamp(sample));
      const auto duration = appleplayback::sourceTicks(CMSampleBufferGetOutputDuration(sample));
      const auto size = CMSampleBufferGetTotalSampleSize(sample);
      const auto count = CMSampleBufferGetNumSamples(sample);
      CFRelease(sample);
      // Compressed payload is borrowed for this iteration only; only timing
      // metadata is retained. Finite byte/count/time bounds apply to the scan.
      if (++samples > 512 || size > 4ULL * 1024 * 1024 || bytes > 16ULL * 1024 * 1024 - size) {
        request->failure = Failure::Bound; break;
      }
      if (count == 0 && size == 0) continue; // bounded non-image control marker
      if (count != 1 || !size || !begin || !duration || !*duration || *begin > 86400ULL * 120000 - *duration) {
        request->failure = Failure::Timing; break;
      }
      bytes += size;
      Interval value{*begin, *begin + *duration};
      auto found = request->intervals.find(value.start);
      if (found != request->intervals.end() && found->second.end != value.end) {
        request->failure = Failure::Conflict; break;
      }
      request->intervals.emplace(value.start, value);
    }
    if (!request->cancelled.load() && (reader.status != AVAssetReaderStatusCompleted ||
        CACurrentMediaTime() >= deadline || request->intervals.empty()) && request->failure == Failure::None) request->failure =
      CACurrentMediaTime() >= deadline ? Failure::Deadline : Failure::Incomplete;
    [reader cancelReading];
    // cancelReading is a normal API, not evidence that a blocked OS read could
    // have been interrupted earlier. The owner waits for this worker to return.
  }
}
}

@implementation STSourceSampleIntervals {
  NSURL* _url;
  BOOL _closed, _busy, _failed;
  Failure _failure;
  std::map<uint64_t, Interval> _intervals;
  std::shared_ptr<Request> _request;
}
- (instancetype)initWithURL:(NSURL *)url {
  NSParameterAssert(NSThread.isMainThread && url.isFileURL);
  if ((self = [super init])) _url = [url copy];
  return self;
}
- (std::optional<Interval>)lookup:(uint64_t)pts {
  NSParameterAssert(NSThread.isMainThread);
  if (_closed || self.failed) return std::nullopt;
  auto found = _intervals.find(pts);
  return found == _intervals.end() ? std::nullopt : std::optional<Interval>(found->second);
}
- (BOOL)request:(uint64_t)pts {
  NSParameterAssert(NSThread.isMainThread);
  if (_closed || _failed || _busy || _intervals.count(pts) || pts > 86400ULL * 120000) return NO;
  _busy = YES;
  auto request = std::make_shared<Request>(); request->deadline = CACurrentMediaTime() + 2; _request = request;
  NSURL* url = _url;
  // The worker owns this index until its completion; cancellation cannot make
  // an old callback publish into another source/index object.
  dispatch_async(metadataQueue(), ^{
    scan(url, pts, request);
    dispatch_async(dispatch_get_main_queue(), ^{
      if (self->_request != request) return;
      self->_busy = NO; self->_request.reset();
      if (self->_closed || request->cancelled.load()) return;
      self->_failure = request->failure != Failure::None ? request->failure :
        CACurrentMediaTime() >= request->deadline ? Failure::Deadline :
        !request->intervals.count(pts) ? Failure::RequestedPTSAbsent : Failure::None;
      self->_failed = self->_failure != Failure::None;
      if (!self->_failed) self->_intervals = std::move(request->intervals);
    });
  });
  return YES;
}
- (BOOL)failed {
  NSParameterAssert(NSThread.isMainThread);
  return _failed || (!_closed && _request && CACurrentMediaTime() >= _request->deadline);
}
- (Failure)failure {
  NSParameterAssert(NSThread.isMainThread);
  return _failure != Failure::None ? _failure :
    (!_closed && _request && CACurrentMediaTime() >= _request->deadline) ? Failure::Deadline : Failure::None;
}
- (BOOL)drained { NSParameterAssert(NSThread.isMainThread); return !_busy; }
- (void)cancel {
  NSParameterAssert(NSThread.isMainThread);
  _closed = YES; _intervals.clear();
  if (_request) _request->cancelled.store(true);
}
@end
