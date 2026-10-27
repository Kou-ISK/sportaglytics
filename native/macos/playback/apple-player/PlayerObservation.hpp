#pragma once
#include <optional>

namespace appleplayback {
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
  if (rate > 0 && rate != requestedRate) return std::nullopt;
  return PlayerObservation{rate > 0 ? "playing" : "paused", rate, true};
}
}
