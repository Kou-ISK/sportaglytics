#pragma once
#include <optional>
#include <cstdint>

namespace appleplayback {
// Actual Drawn PTS progress, independent of capability/rate declarations.
struct ReversePresentationProgress {
  double changedAt = 0;
  std::optional<uint64_t> pts;
  void reset(double now) { changedAt = now; pts.reset(); }
  bool stalled(double now, std::optional<uint64_t> drawnPTS) {
    if (drawnPTS && (!pts || *drawnPTS < *pts)) {
      pts = drawnPTS; changedAt = now;
    }
    return now - changedAt > 1;
  }
};
struct PlayerObservation {
  const char *phase;
  double rate;
  bool ready;
};

template <typename ReadRate>
std::optional<PlayerObservation> samplePlayerObservation(bool ready, bool waiting,
                                                       double requestedRate, ReadRate readRate) {
  if (!ready) return PlayerObservation{"seeking", 0, false};
  if (waiting) return PlayerObservation{"buffering", 0, false};
  // Sample once: AVPlayer may complete pause between separate property reads.
  const double rate = readRate();
  // A pause/rate command and its asynchronous timebase change aren't atomic.
  // Keep the prior confirmed clock until the next poll; normal owner deadlines
  // still apply if the timebase never reaches the requested controls.
  if (rate != 0 && rate != requestedRate) return std::nullopt;
  return PlayerObservation{rate != 0 ? "playing" : "paused", rate, true};
}
}
