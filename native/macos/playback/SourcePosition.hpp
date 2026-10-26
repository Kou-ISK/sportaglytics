#pragma once
#include "SourceTimeline.hpp"
#include "SourceClockFraction.hpp"
#include <cmath>

namespace nativeplayback {
// Compare presentation timestamps without rounding a clock just before a field.
inline bool fieldDue(int64_t field, int64_t clockValue, int32_t clockScale) {
  return field >= 0 && clockValue >= 0 && clockScale > 0 &&
         (__int128)field * clockScale <= (__int128)clockValue * TimeScale;
}
struct SourcePosition {
  int64_t value;
  int32_t scale;
  int64_t field;
  bool coveredByTicks(int64_t start, int64_t end, int64_t reserve) const {
    const __int128 position = (__int128)value * TimeScale;
    return (__int128)start * scale <= position &&
           (__int128)end * scale >= position + (__int128)reserve * scale;
  }
  bool coveredByAudio(const AudioTimeline& audio, int64_t reserve) const {
    const __int128 position = (__int128)value * TimeScale * 2;
    return (__int128)audio.first * 5 * scale <= position &&
           (__int128)audio.end * 5 * scale >= position + (__int128)reserve * scale * 2;
  }
};
// The requested clock and its displayed field are different quantities.
// Keep exact field rationals first; admit other representable clocks without
// rounding the requested source time. Unrepresentable clocks use the original.
inline SourcePosition sourcePosition(double seconds, const FieldTimeline& timeline,
                                     bool containing) {
  if (!std::isfinite(seconds) || seconds < 0 || seconds > MaximumDuration)
    throw std::out_of_range("invalid source clock");
  const int64_t ticks = std::llround(seconds * TimeScale);
  if (double(ticks) / TimeScale == seconds && timeline.contains(ticks))
    return {ticks, int32_t(TimeScale), ticks};
  if (!containing) throw std::out_of_range("source clock requires exact field");
  const auto clock = sourceClockFraction(seconds);
  if (!clock)
    throw std::out_of_range("unrepresentable source clock");
  const auto value = clock->value;
  const auto scale = clock->scale;
  const auto floorTicks = int64_t((__int128)value * TimeScale / scale);
  return {value, scale, timeline.containing(floorTicks)};
}
}
