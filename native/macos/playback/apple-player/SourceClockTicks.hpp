#pragma once
#include <CoreMedia/CoreMedia.h>
#include <cstdint>
#include <optional>

namespace appleplayback {
inline std::optional<uint64_t> sourceTicks(
    CMTime time, CMTimeRoundingMethod rounding = kCMTimeRoundingMethod_Default) {
  if (!CMTIME_IS_NUMERIC(time) || time.timescale <= 0 || time.epoch != 0 ||
      CMTimeCompare(time, kCMTimeZero) < 0 ||
      CMTimeCompare(time, CMTimeMake(86400, 1)) > 0)
    return std::nullopt;
  CMTime ticks = CMTimeConvertScale(time, 120000, rounding);
  if (!CMTIME_IS_NUMERIC(ticks) || ticks.value < 0)
    return std::nullopt;
  return static_cast<uint64_t>(ticks.value);
}
} // namespace appleplayback
