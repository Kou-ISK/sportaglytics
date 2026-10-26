#pragma once
#include <cmath>
#include <cstdint>
#include <optional>

namespace nativeplayback {
struct SourceClockFraction { int64_t value; int32_t scale; };
// Double round-trip equality, not mathematical equality to the binary rational.
// Keep the same bounded algorithm as shared/nativePlayback/sourceClockFraction.ts.
inline std::optional<SourceClockFraction> sourceClockFraction(double seconds) {
  if (!std::isfinite(seconds) || seconds < 0 || seconds > 86400) return {};
  const int64_t nanos = std::llround(seconds * 1000000000);
  if (double(nanos) / 1000000000 == seconds) return SourceClockFraction{nanos, 1000000000};
  double remainder = seconds;
  double previousValue = 0, value = 1, previousScale = 1, scale = 0;
  for (int step = 0; step < 64; ++step) {
    const double coefficient = std::floor(remainder);
    const double nextValue = coefficient * value + previousValue;
    const double nextScale = coefficient * scale + previousScale;
    // Validate before integer casts. Reciprocals can be infinite or exceed the
    // common JS-safe integer range; failure must retain the original fallback.
    if (!std::isfinite(nextValue) || !std::isfinite(nextScale) ||
        nextValue < 0 || nextValue > 9007199254740991.0 ||
        nextScale < 1 || nextScale > 1000000000 ||
        std::floor(nextValue) != nextValue || std::floor(nextScale) != nextScale) return {};
    if (nextValue / nextScale == seconds)
      return SourceClockFraction{int64_t(nextValue), int32_t(nextScale)};
    const double fraction = remainder - coefficient;
    if (!(fraction > 0)) return {};
    previousValue = value; value = nextValue;
    previousScale = scale; scale = nextScale;
    remainder = 1 / fraction;
  }
  return {};
}
}
