#pragma once

// Independent non-UI export entry; playback has its own guards and lifecycle.
int runAppleClipExport(const char *requestPath);

#include <algorithm>
#include <cmath>

// MP4 duration is quantized to the exported video track clock. This is a
// metadata bound only; Main independently qualifies stream timing and interval metadata.
inline bool nativeExportDurationMatches(double actual, double requested, int timescale) {
  if (!std::isfinite(actual) || !std::isfinite(requested) || timescale <= 0) return false;
  const double tolerance = std::min(0.001, 0.5 / timescale + 1.0 / 120000000);
  return std::fabs(actual - requested) <= tolerance;
}
