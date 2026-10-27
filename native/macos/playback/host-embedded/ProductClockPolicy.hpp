#pragma once
#include <cmath>
#include <cstdint>
#include <stdexcept>

namespace diagnostic {
struct ProductClock { bool valid; double time, rate; };
inline bool validProductClock(ProductClock clock) {
 return clock.valid && std::isfinite(clock.time) && clock.time >= 0 &&
        std::isfinite(clock.rate) && clock.rate >= 0;
}
// Non-playing protocol states require a measured stopped clock, never a
// synthetic rate=0. A pending asynchronous rate change publishes nothing.
inline bool mayPublishClock(ProductClock clock, bool playingPhase,
                            bool playingIntent, double requestedRate) {
 if (!validProductClock(clock)) return false;
 return playingPhase ? playingIntent && clock.rate == requestedRate && clock.rate > 0
                     : clock.rate == 0;
}
enum class StopObservation { Waiting, Stopped, Invalid, Expired, Superseded };
class ProductStopAck {
 uint64_t sequence_ = 0;
 double requestedAt_ = 0;
public:
 void begin(uint64_t sequence, double now) {
  if (!sequence || !std::isfinite(now)) throw std::logic_error("invalid stop request");
  sequence_ = sequence; requestedAt_ = now;
 }
 void cancel() { sequence_ = 0; }
 bool pending() const { return sequence_ != 0; }
 double requestedAt() const { return requestedAt_; }
 StopObservation observe(uint64_t sequence, double now, ProductClock clock) const {
  if (!pending() || sequence != sequence_) return StopObservation::Superseded;
  if (!std::isfinite(now) || now < requestedAt_ || !validProductClock(clock))
   return StopObservation::Invalid;
  if (now - requestedAt_ >= 5) return StopObservation::Expired;
  return clock.rate == 0 ? StopObservation::Stopped : StopObservation::Waiting;
 }
};
enum class StartObservation { Waiting, Started, Invalid, Expired };
class ProductStartAck {
 bool pending_ = false;
 double anchor_ = 0, requestedAt_ = 0, minimum_ = 0, observedAt_ = 0;
 uint64_t samples_ = 0, beforeAnchor_ = 0;
public:
 bool begin(ProductClock stopped, double now) {
  if (!validProductClock(stopped) || stopped.rate != 0 || !std::isfinite(now))
   return false;
  anchor_ = stopped.time; requestedAt_ = now; pending_ = true;
  minimum_ = anchor_; observedAt_ = now; samples_ = 0; beforeAnchor_ = 0;
  return true;
 }
 void cancel() { pending_ = false; }
 bool pending() const { return pending_; }
 double anchor() const { return anchor_; }
 double minimumObservedTime() const { return minimum_; }
 double maximumBackwardSeconds() const { return anchor_ - minimum_; }
 double elapsed() const { return observedAt_ - requestedAt_; }
 uint64_t samples() const { return samples_; }
 uint64_t beforeAnchorSamples() const { return beforeAnchor_; }
 StartObservation observe(double now, ProductClock clock) {
  if (!pending_ || !validProductClock(clock) || !std::isfinite(now) ||
      now < requestedAt_ || (clock.rate != 0 && clock.rate != 1))
   return StartObservation::Invalid;
  ++samples_; observedAt_ = now;
  if(clock.time < minimum_) minimum_ = clock.time;
  if(clock.time < anchor_) ++beforeAnchor_;
  if (now - requestedAt_ >= 5) return StartObservation::Expired;
  // Framework startup can expose a running audio clock before the stopped
  // anchor. Keep the pending operation; do not clamp or publish that time.
  return clock.rate == 1 && clock.time >= anchor_ ? StartObservation::Started
                                                : StartObservation::Waiting;
 }
};
}
