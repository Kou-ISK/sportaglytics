#pragma once
#include <cmath>
#include <cstdint>
#include <limits>
#include <optional>
#include <utility>

namespace appleplayback {
// The existing v1 Main profile qualifies 60000/1001 metadata and the wire uses
// 120000 ticks/second. This is a bounded nominal-frame PTS agreement check,
// Clock conversion floors to keep an endpoint just below the exclusive end.
// Permit one wire tick of positive PTS rounding (1/120000s), not a future frame.
// This is not proof of arbitrary/VFR duration or of physical presentation.
inline bool v1StoppedImageMatches(uint64_t clock, uint64_t pts) {
  return pts > clock ? pts - clock <= 1 : clock - pts < 2002;
}

// Logical controls do not own physical seek completion. A re-press can wait on
// a useful correction; only a new media seek/physical seek or close invalidates
// its callback. The helper owns one immutable source for this object's lifetime.
class StoppedImageSettlement {
  uint64_t mediaSeek = 0, motion = 0, physicalSeek = 0;
  bool playing = false, closed = false;
  double rate = 0;
  std::optional<std::pair<uint64_t, uint64_t>> correction;

  bool advance() {
    if (physicalSeek == std::numeric_limits<uint64_t>::max()) {
      closed = true;
      return false;
    }
    ++physicalSeek;
    return true;
  }

public:
  bool accept(uint64_t seek, bool nextPlaying, double nextRate) {
    if (closed || !seek || seek < mediaSeek || !std::isfinite(nextRate))
      return false;
    if (seek != mediaSeek && !advance())
      return false;
    if (nextPlaying && (!playing || nextRate != rate || seek != mediaSeek)) {
      if (motion == std::numeric_limits<uint64_t>::max()) {
        closed = true;
        return false;
      }
      ++motion;
    }
    mediaSeek = seek;
    playing = nextPlaying;
    rate = nextRate;
    return true;
  }
  uint64_t beginSeek() {
    return !closed && mediaSeek && advance() ? physicalSeek : 0;
  }
  bool acceptsCompletion(uint64_t token) const {
    return !closed && token && token == physicalSeek;
  }
  bool takeCorrection() {
    const auto key = std::make_pair(mediaSeek, motion);
    if (closed || !mediaSeek || correction == key)
      return false;
    correction = key;
    return true;
  }
  void close() { closed = true; }
};
} // namespace appleplayback
