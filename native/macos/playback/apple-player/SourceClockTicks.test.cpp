#include "SourceClockTicks.hpp"
#include "StoppedImageSettlement.hpp"
#include <cassert>

int main() {
  using namespace appleplayback;
  const auto floor = kCMTimeRoundingMethod_RoundTowardNegativeInfinity;
  const CMTime firstFrame = CMTimeMake(1001, 60000);
  assert(sourceTicks(firstFrame) == 2002);
  // Existing v1 endpoint adapter seeks a few microseconds below the end. Do not
  // round its clock up to the excluded end and reject a valid final frame.
  const CMTime beforeEnd = CMTimeSubtract(CMTimeMake(2002, 60000), CMTimeMake(2, 1000000));
  assert(sourceTicks(beforeEnd) == 4004);
  assert(sourceTicks(beforeEnd, floor) == 4003);
  assert(v1StoppedImageMatches(*sourceTicks(beforeEnd, floor), *sourceTicks(firstFrame)));
  assert(!v1StoppedImageMatches(*sourceTicks(CMTimeMake(2002, 60000), floor), 2002));
  // A nanosecond player clock can fall just below an exact rational frame edge.
  const CMTime roundedClock = CMTimeMakeWithSeconds(1001.0 / 60000, 1000000000);
  assert(v1StoppedImageMatches(*sourceTicks(roundedClock, floor), *sourceTicks(firstFrame)));
  assert(!sourceTicks(kCMTimeInvalid));
  assert(!sourceTicks(kCMTimeIndefinite));
  assert(!sourceTicks(kCMTimePositiveInfinity));
  assert(!sourceTicks(CMTimeMake(-1, 60000)));
  assert(!sourceTicks(CMTimeMake(86401, 1)));
  CMTime invalid = kCMTimeZero;
  invalid.epoch = 1;
  assert(!sourceTicks(invalid));
  invalid = kCMTimeZero;
  invalid.timescale = 0;
  assert(!sourceTicks(invalid));
}
