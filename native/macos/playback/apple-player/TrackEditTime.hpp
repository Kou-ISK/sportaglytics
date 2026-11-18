#pragma once
#include "SourceClockTicks.hpp"

namespace appleplayback {
// The media timestamp and the track presentation timestamp may differ by
// an edit-list offset. Accept only a whole sample translated at unit speed.
inline bool matchesUnitRateEdit(CMTimeMapping edit, CMTime pts, CMTime duration,
                                CMTime outputPTS, CMTime outputDuration) {
  if (!sourceTicks(edit.source.start) || !sourceTicks(edit.target.start) ||
      !sourceTicks(edit.source.duration) || !sourceTicks(edit.target.duration) ||
      !sourceTicks(pts) || !sourceTicks(duration) ||
      !sourceTicks(outputPTS) || !sourceTicks(outputDuration) ||
      CMTimeCompare(duration, kCMTimeZero) <= 0 ||
      CMTimeCompare(duration, outputDuration) != 0 ||
      CMTimeCompare(edit.source.duration, edit.target.duration) != 0)
    return false;
  const auto sourceEnd = CMTimeAdd(pts, duration);
  const auto editEnd = CMTimeRangeGetEnd(edit.source);
  const auto projected = CMTimeAdd(edit.target.start, CMTimeSubtract(pts, edit.source.start));
  return CMTIME_IS_NUMERIC(sourceEnd) && CMTIME_IS_NUMERIC(editEnd) && CMTIME_IS_NUMERIC(projected) &&
         !CMTIME_HAS_BEEN_ROUNDED(sourceEnd) && !CMTIME_HAS_BEEN_ROUNDED(editEnd) &&
         !CMTIME_HAS_BEEN_ROUNDED(projected) &&
         CMTimeCompare(pts, edit.source.start) >= 0 &&
         CMTimeCompare(sourceEnd, editEnd) <= 0 &&
         CMTimeCompare(projected, outputPTS) == 0;
}
}
