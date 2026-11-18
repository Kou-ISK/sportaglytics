#include "PlayerObservation.hpp"
#include <cassert>
#include <cstring>
#include <initializer_list>
#include <limits>

int main() {
  // The AVPlayer timebase changes independently of our main-thread polling.
  // Reproduce the observed 2x -> pause transition between two property reads.
  appleplayback::ReversePresentationProgress progress;
  progress.reset(0);
  assert(!progress.stalled(.9, std::nullopt, 3000, -2));
  assert(progress.stalled(1.01, std::nullopt, 3000, -2)); // rate alone is not presentation
  progress.reset(2);
  assert(!progress.stalled(2.1, 3000, 3000, -2));
  assert(!progress.stalled(2.9, 3000, 3000, -2));
  assert(progress.stalled(3.2, 3000, 3000, -2)); // repeating one image does not refresh it
  progress.reset(4);
  for (int n = 0; n < 100; n++) assert(!progress.stalled(4 + n * .05, 5000 - n, 5000 - n, -2));
  // Reproduce advancing output that falls increasingly behind a reverse clock.
  // The old progress-only watchdog accepts every row because PTS decreases.
  progress.reset(10);
  assert(!progress.stalled(10.1, 2400000, 2376000, -2));
  assert(!progress.stalled(10.6, 2360000, 2256000, -2));
  assert(progress.stalled(11.6, 2320000, 2016000, -2));
  for (double rate : {-0.5, -2.0, -4.0, -6.0}) {
    const uint64_t limit = static_cast<uint64_t>(-rate * 120000);
    progress.reset(20);
    assert(!progress.stalled(20.1, 2400000, 2400000 - limit, rate));
    assert(progress.stalled(20.2, 2399999, 2399998 - limit, rate));
    progress.reset(30);
    assert(progress.stalled(30.1, 0, limit + 1, rate)); // wrong side also bounded
    progress.reset(40);
    assert(!progress.stalled(40.1, 2002, 0, rate)); // ordinary final-frame offset
  }
  progress.reset(50);
  assert(progress.stalled(49, 100, 100, -2));
  assert(progress.stalled(50.1, 100, std::nullopt, -2));
  assert(progress.stalled(50.1, 100, 100, 0));
  assert(progress.stalled(50.1, 100, 100, std::numeric_limits<double>::quiet_NaN()));
  assert(progress.stalled(50.1, std::numeric_limits<uint64_t>::max(), 0, -6));
  // Settings-only sequences cannot keep a motion alive with no Drawn image.
  assert(progress.controls(70, 1, true, -2));
  assert(!progress.stalled(70.1, 3000, 3000, -2));
  for (int n = 1; n <= 10; n++)
    assert(progress.controls(70.1 + n * .1, 1, true, -2));
  assert(progress.stalled(71.2, std::nullopt, 3000, -2));
  assert(progress.controls(72, 1, false, -2));
  assert(progress.controls(73, 1, true, -2)); // re-press owns a fresh wait
  assert(!progress.stalled(73.1, std::nullopt, 3000, -2));
  assert(progress.controls(74, 1, true, -4)); // rate/direction changes reset
  assert(!progress.stalled(74.1, std::nullopt, 3000, -4));
  assert(progress.controls(75, 2, true, -4)); // explicit seek resets
  assert(!progress.stalled(75.1, std::nullopt, 3000, -4));
  assert(!progress.controls(76, 1, true, -4)); // old seek cannot renew it
  assert(progress.stalled(76.1, std::nullopt, 3000, -4));
  progress.reset(std::numeric_limits<double>::quiet_NaN());
  assert(!progress.controls(77, 3, true, -4)); // corrupt timing cannot be renewed
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
