#include "SourcePosition.hpp"
#include <cassert>
#include <limits>

int main() {
  using namespace nativeplayback;
  const FieldTimeline timeline(0, 1200000 * FieldStep);
  const auto exact = sourcePosition(double(1001) / 120000, timeline, true);
  assert(exact.value == 1001 && exact.scale == 120000 && exact.field == 1001);
  const auto before = sourcePosition(0.008341666, timeline, true);
  const auto after = sourcePosition(0.008341667, timeline, true);
  assert(before.field == 0 && after.field == 1001);
  const auto a = sourcePosition(1.123, timeline, true);
  const auto b = sourcePosition(1.123001, timeline, true);
  assert(a.field == b.field && a.value != b.value);
  assert(double(a.value) / a.scale == 1.123);
  assert(sourcePosition(2.500000001, timeline, true).field * 2 / 5 < 120000);
  const auto html = sourcePosition(9017.992316, timeline, true);
  assert(double(html.value) / html.scale == 9017.992316);
  assert(html.field == 1082158077); // HTML microseconds are just before the next field.
  assert(fieldDue(html.field, html.value, html.scale));
  assert(!fieldDue(html.field + FieldStep, html.value, html.scale));
  assert(fieldDue(1001, 1001, 120000));
  assert(!fieldDue(1001, before.value, before.scale));
  assert(fieldDue(1001, after.value, after.scale));
  assert(!fieldDue(0, 0, 0));
  const auto boundary = sourcePosition(2.500000001, timeline, true);
  const AudioTimeline audio(0, 240000);
  assert(audio.index(boundary.field * 2 / 5) == 0);
  assert(boundary.coveredByAudio(audio, 24 * FieldStep));
  assert(!boundary.coveredByTicks(0, 300000 + 24 * FieldStep, 24 * FieldStep));
  assert(boundary.coveredByTicks(0, 300001 + 24 * FieldStep, 24 * FieldStep));
  const auto end = sourcePosition(2.5, timeline, true);
  const AudioTimeline shortAudio(0, 120000);
  assert(end.coveredByAudio(shortAudio, 0));
  assert(!boundary.coveredByAudio(shortAudio, 0));
  for (double seconds : {2709.002386456509, 1.123000000123, 2.500001 + 10}) {
    const auto position = sourcePosition(seconds, timeline, true);
    assert(double(position.value) / position.scale == seconds);
    assert(position.scale > 0 && position.scale <= 1000000000);
    assert(fieldDue(position.field, position.value, position.scale));
    assert(!fieldDue(position.field + FieldStep, position.value, position.scale));
    assert(position.coveredByTicks(position.field, position.field + 25 * FieldStep, 24 * FieldStep));
  }
  // Adjacent doubles must not silently select a future field. Some tiny
  // boundary offsets remain unrepresentable and correctly retain fallback.
  for (int64_t index : {1, 299, 300, 120000, 540000, 1081000}) {
    const int64_t ticks = index * FieldStep;
    const double exactSeconds = double(ticks) / TimeScale;
    assert(sourcePosition(exactSeconds, timeline, true).field == ticks);
    for (double seconds : {std::nextafter(exactSeconds, 0.0),
                           std::nextafter(exactSeconds, 86400.0)}) {
      const auto fraction = sourceClockFraction(seconds);
      if (!fraction) continue;
      const auto position = sourcePosition(seconds, timeline, true);
      assert(double(position.value) / position.scale == seconds);
      assert(fieldDue(position.field, position.value, position.scale));
      assert(!fieldDue(position.field + FieldStep, position.value, position.scale));
      assert(position.field == (seconds < exactSeconds ? ticks - FieldStep : ticks));
    }
  }
  for (const auto value : {-1.0, 86401.0, std::numeric_limits<double>::infinity(),
                            std::numeric_limits<double>::quiet_NaN(), 1e-20}) {
    bool rejected = false;
    try { sourcePosition(value, timeline, true); } catch (const std::exception&) { rejected = true; }
    assert(rejected);
  }
  bool rejected = false;
  try { sourcePosition(1.123, timeline, false); } catch (const std::exception&) { rejected = true; }
  assert(rejected);
}
