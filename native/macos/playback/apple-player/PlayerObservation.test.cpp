#include "PlayerObservation.hpp"
#include <cassert>
#include <cstring>
#include <initializer_list>

int main() {
  // The AVPlayer timebase changes independently of our main-thread polling.
  // Reproduce the observed 2x -> pause transition between two property reads.
  int reads = 0;
  auto transition = appleplayback::samplePlayerObservation(true, false, 2, [&] {
    return ++reads == 1 ? 2.0 : 0.0;
  });
  assert(transition && std::strcmp(transition->phase, "playing") == 0);
  assert(transition->rate == 2 && transition->ready && reads == 1);
  auto paused = appleplayback::samplePlayerObservation(true, false, 0, [] { return 0.0; });
  assert(paused && std::strcmp(paused->phase, "paused") == 0 && paused->rate == 0 && paused->ready);
  assert(!appleplayback::samplePlayerObservation(true, false, 0, [] { return 2.0; }));
  assert(!appleplayback::samplePlayerObservation(true, false, 2, [] { return 1.0; }));
  for (bool ready : {false, true}) {
    auto waiting = appleplayback::samplePlayerObservation(ready, true, 2, [] {
      assert(false); return 2.0;
    });
    assert(waiting && std::strcmp(waiting->phase, ready ? "buffering" : "seeking") == 0);
    assert(waiting->rate == 0 && !waiting->ready);
  }
}
