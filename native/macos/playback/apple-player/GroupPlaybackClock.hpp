#pragma once
#include <algorithm>
#include <cmath>
#include <cstdint>
#include <optional>
#include <stdexcept>

namespace appleplayback {
inline bool supportedGroupRate(double speed) {
  return std::isfinite(speed) && ((speed >= .25 && speed <= 6) ||
    speed == -.5 || speed == -2 || speed == -4 || speed == -6);
}
struct GroupClockSample { uint64_t ticks; bool running, ended; };
/// The common host clock is distinct from AVPlayer audio time, decoded sample
/// time and drawn-pair time. This class grants no presentation/stop authority.
class GroupPlaybackClock {
  uint64_t minimum, maximum, anchor;
  double rate = 0, host = 0;
  bool armed = false;
  std::optional<uint64_t> pending;
  static void time(double value) {
    if (!std::isfinite(value) || value < 0) throw std::invalid_argument("group host time");
  }
public:
  GroupPlaybackClock(uint64_t start, uint64_t end) : minimum(start), maximum(end), anchor(start) {
    if (start >= end || end > 86400ULL * 120000) throw std::invalid_argument("group clock range");
  }
  void pauseAt(uint64_t ticks) {
    if (ticks < minimum || ticks >= maximum) throw std::invalid_argument("group clock anchor");
    anchor = ticks; rate = 0; armed = false; pending.reset();
  }
  void suspend(uint64_t shown, uint64_t needed) {
    if (needed < minimum || needed >= maximum) throw std::invalid_argument("group pending sample");
    pauseAt(shown); pending = needed;
  }
  std::optional<uint64_t> pendingTarget() const { return pending; }
  void schedule(uint64_t ticks, double speed, double atHost, double now) {
    time(atHost); time(now);
    if (!supportedGroupRate(speed) ||
        atHost <= now || atHost - now > 1)
      throw std::invalid_argument("group clock schedule");
    pauseAt(ticks); host = atHost; rate = speed; armed = true;
  }
  void resumeAt(uint64_t drawn, double speed, double atHost, double now) {
    if (!pending || drawn != *pending) throw std::invalid_argument("group resume fence");
    schedule(drawn, speed, atHost, now);
  }
  GroupClockSample sample(double now) const {
    time(now);
    if (!armed || now < host) return {anchor, false, false};
    const long double value = anchor + (static_cast<long double>(now) - host) * rate * 120000;
    const bool ended = value < minimum || value >= maximum;
    const auto ticks = uint64_t(std::llround(std::clamp(value,
      static_cast<long double>(minimum), static_cast<long double>(maximum - 1))));
    return {ticks, !ended, ended};
  }
  double scheduledRate(double now) const { return sample(now).running ? rate : 0; }
};
} // namespace appleplayback
