#include "GroupPlaybackClock.hpp"
#include "GroupDecodeWindow.hpp"
#include <cassert>
#include <limits>
int main() {
  using namespace appleplayback;
  GroupPlaybackClock clock(0, 120000);
  assert(clock.sample(1).ticks == 0 && !clock.sample(1).running);
  for (double speed : {-.5, -2., -4., -6., .5, 1., 2., 4., 6.}) {
    clock.schedule(60000, speed, 64, 63.5);
    assert(clock.sample(63.9).ticks == 60000 && !clock.sample(63.9).running);
    const auto expected = uint64_t(std::llround(60000 + speed * 1875));
    assert(clock.sample(64.015625).ticks == expected);
    const auto stopped = clock.sample(64.015625).ticks;
    clock.pauseAt(stopped); assert(clock.sample(100).ticks == stopped && !clock.sample(100).running);
    clock.schedule(stopped, speed, 128, 127.5);
    assert(clock.sample(127.9).ticks == stopped); // re-press does not return to first seek
  }
  for (double speed : {-.5, -2., -4., -6.}) {
    clock.pauseAt(60000);
    clock.startReverse(60000, speed, 64);
    assert(clock.sample(64).running && clock.sample(64).ticks == 60000);
    assert(clock.sample(64.015625).ticks == uint64_t(std::llround(60000 + speed * 1875)));
  }
  const auto rejects = [](auto fn) {
    try { fn(); } catch (const std::invalid_argument &) { return true; }
    return false;
  };
  assert(rejects([&]{ clock.startReverse(60000, -6, 65); })); // already armed
  clock.suspend(45000, 30000);
  assert(rejects([&]{ clock.startReverse(45000, -6, 65); }));
  assert(rejects([&]{ clock.resumeReverseAt(45000, -6, 65); }));
  assert(rejects([&]{ clock.resumeReverseAt(30000, 1, 65); }));
  assert(rejects([&]{ clock.resumeReverseAt(30000, -6, std::numeric_limits<double>::quiet_NaN()); }));
  assert(clock.pendingTarget() == 30000 && !clock.sample(65).running);
  clock.resumeReverseAt(30000, -6, 65);
  assert(!clock.pendingTarget() && clock.sample(65).ticks == 30000);
  clock.suspend(25000, 23000); clock.pauseAt(23000); // a new operation owns even this same tick
  assert(rejects([&]{ clock.resumeReverseAt(23000, -6, 66); }));
  assert(rejects([&]{ clock.startReverse(24000, -6, 66); }));
  assert(!clock.sample(66).running && clock.sample(66).ticks == 23000);
  clock.pauseAt(100); clock.startReverse(100, -6, 66);
  assert(clock.sample(66.01).ended && clock.sample(66.01).ticks == 0);
  clock.schedule(100, -6, 64, 63.5);
  assert(clock.sample(65).ended && clock.sample(65).ticks == 0);
  clock.schedule(119900, 6, 64, 63.5);
  assert(clock.sample(65).ended && clock.sample(65).ticks == 119999);
  clock.suspend(45000, 30000);
  assert(clock.sample(100).ticks == 45000 && !clock.sample(100).running && clock.pendingTarget() == 30000);
  bool stale = false;
  try { clock.resumeAt(45000, -2, 128, 127.5); } catch (...) { stale = true; }
  assert(stale && clock.pendingTarget() == 30000);
  clock.resumeAt(30000, -2, 128, 127.5);
  assert(!clock.pendingTarget() && clock.sample(128.015625).ticks == 26250);
  clock.suspend(25000, 23000); clock.pauseAt(24000);
  stale = false;
  try { clock.resumeAt(23000, -2, 128, 127.5); } catch (...) { stale = true; }
  assert(stale && !clock.pendingTarget()); // new input revokes the old pending target
  for (double rate : {0., -1., 7., std::numeric_limits<double>::quiet_NaN()}) {
    bool rejected = false; try { clock.schedule(60000, rate, 64, 63.5); } catch (...) { rejected = true; }
    assert(rejected);
  }
  assert(!nextGroupDecodeWindow(60000, 30000, 90000, 0, 120000, 0));
  assert(!nextGroupDecodeWindow(29999, 30000, 90000, 0, 120000, -2));
  assert((nextGroupDecodeWindow(60000, 30000, 90000, 0, 120000, -.5) == std::pair<uint64_t,uint64_t>{0,30000}));
  assert((nextGroupDecodeWindow(60000, 30000, 90000, 0, 120000, 2) == std::pair<uint64_t,uint64_t>{90000,120000}));
  assert(!nextGroupDecodeWindow(1000, 0, 60000, 0, 120000, -6));
  assert(!nextGroupDecodeWindow(119000, 60000, 120000, 0, 120000, 6));
}
