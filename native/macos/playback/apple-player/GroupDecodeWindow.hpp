#pragma once
#include <algorithm>
#include <cmath>
#include <cstdint>
#include <optional>
#include <utility>
#include "GroupPlaybackClock.hpp"

namespace appleplayback {
/// Planning only: the owner still requires an idle worker, a validated source
/// and an actual retained-image budget. The lookahead is not a fill-time promise.
inline std::optional<std::pair<uint64_t, uint64_t>> nextGroupDecodeWindow(
    uint64_t query, uint64_t start, uint64_t end, uint64_t minimum,
    uint64_t maximum, double rate) {
  if (!supportedGroupRate(rate) ||
      minimum > start || start >= end || end > maximum ||
      query < start || query >= end)
    return std::nullopt; // never evict the bank still serving a different range
  const double distance = rate < 0 ? double(query - start) : double(end - query);
  if (distance > std::abs(rate) * .75 * 120000) return std::nullopt;
  if (rate < 0) {
    if (start == minimum) return std::nullopt;
    return std::pair{start - std::min<uint64_t>(start - minimum, 60000), start};
  }
  if (end == maximum) return std::nullopt;
  return std::pair{end, end + std::min<uint64_t>(maximum - end, 60000)};
}
} // namespace appleplayback
