#pragma once
#include <algorithm>
#include <cstdint>
#include <stdexcept>

namespace nativeplayback {
// The initial decoder profile is CFR H.264 60000/1001 with two output fields.
// Positions and lengths are source ticks, never rebased to a playback window.
constexpr int64_t FieldStep = 1001;
constexpr int64_t TimeScale = 120000;
constexpr int64_t SampleRate = 48000;
constexpr int64_t MaximumDuration = 86400;
constexpr int64_t AudioWindowSamples = 120000;

class FieldTimeline {
 public:
  const int64_t first;
  const int64_t end;
  FieldTimeline(int64_t start, int64_t stop) : first(start), end(stop) {
    if (start < 0 || stop <= start || stop > MaximumDuration * TimeScale ||
        start % (2 * FieldStep) || (stop - start) % FieldStep)
      throw std::invalid_argument("invalid source field timeline");
  }
  bool contains(int64_t pts) const {
    return pts >= first && pts < end && (pts - first) % FieldStep == 0;
  }
  int64_t containing(int64_t pts) const {
    if (pts < first || pts >= end) throw std::out_of_range("source field target");
    return first + (pts - first) / FieldStep * FieldStep;
  }
  int64_t prerollInputPTS(int64_t target) const {
    if (!contains(target)) throw std::out_of_range("source field preroll");
    // At source start bwdif uses its actual edge handling; no negative seek.
    return std::max(first / 2, (target / (2 * FieldStep) - 1) * FieldStep);
  }
};

struct AudioWindow { int64_t start, end; };
class AudioTimeline {
 public:
  const int64_t first;
  const int64_t end;
  AudioTimeline(int64_t start, int64_t stop) : first(start), end(stop) {
    if (start < 0 || stop <= start || stop > MaximumDuration * SampleRate)
      throw std::invalid_argument("invalid source audio timeline");
  }
  bool validWindow(int64_t start, int64_t stop) const {
    return start >= first && stop > start && stop <= end &&
           stop - start <= AudioWindowSamples;
  }
  int64_t index(int64_t sample) const {
    if (sample < first || sample >= end) throw std::out_of_range("source audio target");
    return (sample - first) / AudioWindowSamples;
  }
  AudioWindow window(int64_t index) const {
    if (index < 0 || index > (end - first - 1) / AudioWindowSamples)
      throw std::out_of_range("source audio window");
    const auto start = first + index * AudioWindowSamples;
    return {start, std::min(end, start + AudioWindowSamples)};
  }
  bool coversField(int64_t ticks, int64_t reserve) const {
    // Compare rational source clocks without truncating half ticks.
    return ticks >= 0 && reserve >= 0 &&
           (__int128)ticks * 2 >= (__int128)first * 5 &&
           ((__int128)ticks + reserve) * 2 <= (__int128)end * 5;
  }
};
}
