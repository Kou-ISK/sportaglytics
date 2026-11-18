#include "StoppedImageSettlement.hpp"
#include <cassert>

int main() {
  using namespace appleplayback;
  const auto end = std::numeric_limits<uint64_t>::max();
  // Half-open nominal-frame agreement, including unsigned overflow boundaries.
  assert(v1StoppedImageMatches(0, 0, end));
  assert(v1StoppedImageMatches(2001, 0, end));
  assert(!v1StoppedImageMatches(2002, 0, end));
  assert(v1StoppedImageMatches(1999, 2000, end));
  assert(!v1StoppedImageMatches(1998, 2000, end));
  const auto maximum = std::numeric_limits<uint64_t>::max();
  assert(v1StoppedImageMatches(maximum - 1, maximum - 2002, end));
  assert(!v1StoppedImageMatches(maximum - 1, maximum - 2003, end));

  assert(!v1StoppedImageMatches(0, 0, 0));
  assert(!v1StoppedImageMatches(4003, 4004, 4004));
  assert(v1StoppedImageMatches(4004, 2002, 4004));
  assert(!v1StoppedImageMatches(4005, 2002, 4004));
  assert(!v1StoppedImageMatches(4004, 4004, 4004));

  StoppedImageWait wait;
  wait.begin(0);
  assert(!wait.expired(4.999));
  wait.begin(4); // correction/repeated pending control cannot extend the wait
  assert(wait.expired(5));
  wait.begin(6, true); // a new explicit seek has its own finite budget
  assert(!wait.expired(10.999) && wait.expired(11));
  wait.moving(); // do not reuse an old stop deadline at natural EOM
  assert(!wait.expired(100));
  wait.begin(100);
  assert(!wait.expired(104.999) && wait.expired(105));
  assert(wait.expired(99)); // a regressed/unknown monotonic clock fails closed
  assert(wait.expired(std::numeric_limits<double>::quiet_NaN()));

  StoppedImageSettlement gate;
  assert(!gate.beginSeek() && !gate.takeCorrection());
  assert(!gate.accept(0, false, -2));
  assert(gate.accept(1, false, -2));
  const auto initial = gate.beginSeek();
  assert(gate.acceptsCompletion(initial));
  assert(gate.accept(1, true, -2));
  assert(gate.accept(1, false, -2));
  assert(gate.takeCorrection());
  const auto correction = gate.beginSeek();
  assert(!gate.acceptsCompletion(initial));
  assert(!gate.takeCorrection());
  // Audio/volume-only control sequences must not restart useful decoding.
  assert(gate.accept(1, false, -2) && !gate.takeCorrection());
  // Re-press and release before completion keep the useful physical callback.
  assert(gate.accept(1, true, -2));
  assert(gate.acceptsCompletion(correction));
  assert(gate.accept(1, false, -2));
  assert(gate.acceptsCompletion(correction));
  assert(gate.takeCorrection());
  const auto second = gate.beginSeek();
  assert(!gate.acceptsCompletion(correction));
  assert(!gate.takeCorrection());
  // Direction change is a new motion, but not a replacement media seek.
  assert(gate.accept(1, true, -2));
  assert(gate.accept(1, true, 1));
  assert(gate.acceptsCompletion(second));
  assert(gate.accept(1, false, 1) && gate.takeCorrection());
  // A newer explicit seek invalidates old completion even before it is issued.
  assert(gate.accept(2, false, 1));
  assert(!gate.acceptsCompletion(second));
  const auto latest = gate.beginSeek();
  assert(gate.acceptsCompletion(latest));
  assert(!gate.accept(2, true, std::numeric_limits<double>::infinity()));
  assert(!gate.accept(2, true, std::numeric_limits<double>::quiet_NaN()));
  assert(!gate.acceptsCompletion(0));
  assert(!gate.accept(1, false, 1));
  assert(gate.acceptsCompletion(latest));
  gate.close();
  assert(!gate.acceptsCompletion(latest));
  assert(!gate.accept(3, false, 1));
  assert(!gate.beginSeek() && !gate.takeCorrection());
}
