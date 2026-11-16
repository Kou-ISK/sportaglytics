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
inline bool v1StoppedImageMatches(uint64_t clock, uint64_t pts, uint64_t end) {
  if (!end || clock > end || pts >= end) return false;
  // A naturally ended player holds the final image with its clock at end.
  // Compare against the final interval without changing the published clock;
  // neither an image at the excluded end nor a clock past it is acceptable.
  const uint64_t position = clock == end ? end - 1 : clock;
  return pts > position ? pts - position <= 1 : position - pts < 2002;
}

class StoppedImageWait {
  std::optional<double> began;
  bool invalid = false;
public:
  void begin(double now, bool replacement = false) {
    if (!std::isfinite(now) || now < 0) { invalid = true; return; }
    if (!began || replacement) began = now;
  }
  void moving() { began.reset(); }
  bool expired(double now) const {
    return invalid || (began && (!std::isfinite(now) || now < *began || now - *began >= 5));
  }
};

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
