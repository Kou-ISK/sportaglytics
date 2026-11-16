#include "StoppedImageSettlement.hpp"
#include <cassert>

int main() {
  using namespace appleplayback;
  // Half-open nominal-frame agreement, including unsigned overflow boundaries.
  assert(v1StoppedImageMatches(0, 0));
  assert(v1StoppedImageMatches(2001, 0));
  assert(!v1StoppedImageMatches(2002, 0));
  assert(v1StoppedImageMatches(1999, 2000));
  assert(!v1StoppedImageMatches(1998, 2000));
  const auto maximum = std::numeric_limits<uint64_t>::max();
  assert(v1StoppedImageMatches(maximum, maximum - 2001));
  assert(!v1StoppedImageMatches(maximum, maximum - 2002));

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
