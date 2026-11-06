#include "PlayerObservation.hpp"
#include <cassert>
#include <cstring>
#include <initializer_list>

int main() {
  // The AVPlayer timebase changes independently of our main-thread polling.
  // Reproduce the observed 2x -> pause transition between two property reads.
  appleplayback::ReversePresentationProgress progress;
  progress.reset(0);
  assert(!progress.stalled(.9, std::nullopt));
  assert(progress.stalled(1.01, std::nullopt)); // rate alone is not presentation
  progress.reset(2);
  assert(!progress.stalled(2.1, 3000));
  assert(!progress.stalled(2.9, 3000));
  assert(progress.stalled(3.2, 3000)); // repeating one image does not refresh it
  progress.reset(4);
  for (int n = 0; n < 100; n++) assert(!progress.stalled(4 + n * .05, 5000 - n));
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
  for (double rate : {-0.5, -2.0, -4.0, -6.0}) {
    auto reverse = appleplayback::samplePlayerObservation(true, false, rate, [=] { return rate; });
    assert(reverse && std::strcmp(reverse->phase, "playing") == 0 && reverse->rate == rate);
    assert(!appleplayback::samplePlayerObservation(true, false, 0, [=] { return rate; }));
    assert(!appleplayback::samplePlayerObservation(true, false, rate, [] { return 1.0; }));
    auto boundary = appleplayback::samplePlayerObservation(true, false, rate, [] { return 0.0; });
    assert(boundary && std::strcmp(boundary->phase, "paused") == 0);
  }
  for (bool ready : {false, true}) {
    auto waiting = appleplayback::samplePlayerObservation(ready, true, 2, [] {
      assert(false); return 2.0;
    });
    assert(waiting && std::strcmp(waiting->phase, ready ? "buffering" : "seeking") == 0);
    assert(waiting->rate == 0 && !waiting->ready);
  }
}
