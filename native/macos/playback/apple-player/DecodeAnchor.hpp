#pragma once
#import <AVFoundation/AVFoundation.h>
#include "SourceClockTicks.hpp"
#include <functional>

namespace appleplayback {
/// Choose a verified full-sync sample before the requested window, rather than
/// padding across another GOP. Partial-sync samples never grant a fresh decode.
/// Missing cursor/metadata or a bounded unsuccessful search keeps the previous
/// conservative reader anchor. SDK calls themselves may still block; stopping
/// publication is not physical cancellation of an unresponsive SDK operation.
inline CMTime decodeAnchor(AVAssetTrack *track, CMTime requested, CMTime fallback,
                           const std::function<bool()> &stopped) {
  if (stopped()) return fallback;
  auto cursor = [track makeSampleCursorWithPresentationTimeStamp:requested];
  for (size_t step = 0; cursor && step < 512 && !stopped(); ++step) {
    const CMTime sample = cursor.presentationTimeStamp;
    if (sourceTicks(sample) && CMTimeCompare(sample, requested) <= 0 &&
        cursor.currentSampleSyncInfo.sampleIsFullSync)
      return sample;
    if ([cursor stepInDecodeOrderByCount:-1] != -1) break;
  }
  return fallback;
}
} // namespace appleplayback
