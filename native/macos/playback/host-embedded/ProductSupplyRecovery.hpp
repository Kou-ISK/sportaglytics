#pragma once
#include "ProductPreroll.hpp"
#include "../SourcePosition.hpp"
#include <optional>

namespace diagnostic {
enum class SupplyObservation { Stopping, Refilling, Invalid, Expired };

inline bool withinTransientVideoWindow(double now, double began) {
 return std::isfinite(now) && std::isfinite(began) && now >= began && now - began < .010;
}

// Keep the existing audio clock running for a video-only scheduling gap. Both
// source-time lag and uninterrupted wall time must remain below 10 ms. This
// never grants missing PCM, retimes a field, or waits synchronously for a worker.
inline bool transientVideoShortage(double now, double began, int64_t value,
                                  int32_t scale, int64_t videoEnd,
                                  int64_t audioStart, int64_t audioEnd,
                                  bool audioValid) {
 if (!withinTransientVideoWindow(now, began) || value < 0 || scale <= 0 || videoEnd < 0 ||
     audioStart < 0 || !audioValid) return false;
 const __int128 clock = (__int128)value * Scale;
 const __int128 video = (__int128)videoEnd * scale;
 return clock >= video && clock - video < (__int128)(Scale / 100) * scale &&
        clock >= (__int128)audioStart * scale && clock < (__int128)audioEnd * scale;
}

// One bounded episode, independent of seek's original image/audio ACKs. The
// actual stopped clock is immutable: never round/rewind it to a decoded field.
// Control changes in the same seek do not extend this deadline. Seek/close
// cancel the episode before dispatching their own operation.
class ProductSupplyRecovery {
 bool active_ = false, resuming_ = false;
 uint64_t generation_ = 0, seek_ = 0;
 double began_ = 0;
 int64_t detectedValue_ = 0;
 int32_t detectedScale_ = 0;
 double spent_ = 0;
 std::optional<nativeplayback::SourcePosition> stopped_;
public:
 bool begin(uint64_t generation, uint64_t seek, double now,
            int64_t value, int32_t scale) {
  if (active_ || spent_ >= 5 || !generation || !seek || !std::isfinite(now) || value < 0 || scale <= 0)
   return false;
  active_ = true; generation_ = generation; seek_ = seek; began_ = now;
  detectedValue_ = value; detectedScale_ = scale; stopped_.reset();
  return true;
 }
 void cancel() { active_ = false; resuming_ = false; stopped_.reset(); }
 void finish(double now) { spent_ += now - began_; cancel(); }
 bool awaitResume() {
  if (!active_ || resuming_ || !stopped_) return false;
  resuming_ = true;
  return true;
 }
 bool pending() const { return active_; }
 bool expired(double now) const {
  return active_ && (!std::isfinite(now) || now < began_ || spent_ + now - began_ >= 5);
 }
 // Only an explicit new user play or a new seek may reset this budget.
 // Automatic resume never resets it; sustained slow supply must fall back.
 void resetBudget() { if (!active_) spent_ = 0; }
 bool active() const { return active_ && !resuming_; }
 const std::optional<nativeplayback::SourcePosition>& stopped() const { return stopped_; }
 double began() const { return began_; }
 SupplyObservation observe(uint64_t generation, uint64_t seek, double now,
                           bool valid, int64_t value, int32_t scale, double rate,
                           const nativeplayback::FieldTimeline& timeline) {
  if (!active_ || generation != generation_ || seek != seek_ || !valid ||
      !std::isfinite(now) || now < began_ || value < 0 || scale <= 0 ||
      !std::isfinite(rate) || (rate != 0 && rate != 1)) return SupplyObservation::Invalid;
  if (spent_ + now - began_ >= 5) return SupplyObservation::Expired;
  if ((__int128)value * detectedScale_ < (__int128)detectedValue_ * scale)
   return SupplyObservation::Invalid;
  if (stopped_) {
   if (rate != 0 || (__int128)value * stopped_->scale != (__int128)stopped_->value * scale)
    return SupplyObservation::Invalid;
  } else {
   if (rate != 0) return SupplyObservation::Stopping;
   const __int128 ticks = (__int128)value * Scale / scale;
   if (ticks < timeline.first || ticks >= timeline.end) return SupplyObservation::Invalid;
   stopped_ = nativeplayback::SourcePosition{value, scale, timeline.containing(int64_t(ticks))};
  }
  return SupplyObservation::Refilling;
 }
 bool ready(Reserve video, int64_t audioStart, int64_t audioEnd,
            bool reliableAudio, bool displayedCurrentField) const {
  return active_ && stopped_ && reliableAudio &&
   stopped_->coveredByTicks(audioStart, audioEnd, 24 * Step) &&
   readyForProductStart(stopped_->value, stopped_->scale, 0, video, audioEnd,
                        displayedCurrentField);
 }
};
}
