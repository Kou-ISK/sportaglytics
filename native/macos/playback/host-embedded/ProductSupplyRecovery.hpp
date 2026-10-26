#pragma once
#include "ProductPreroll.hpp"
#include "../SourcePosition.hpp"
#include <optional>

namespace diagnostic {
enum class SupplyObservation { Stopping, Refilling, Invalid, Expired };

// One bounded episode, independent of seek's original image/audio ACKs. The
// actual stopped clock is immutable: never round/rewind it to a decoded field.
// Control changes in the same seek do not extend this deadline. Seek/close
// cancel the episode before dispatching their own operation.
class ProductSupplyRecovery {
 bool active_ = false;
 uint64_t generation_ = 0, seek_ = 0;
 double began_ = 0;
 int64_t detectedValue_ = 0;
 int32_t detectedScale_ = 0;
 unsigned attempts_ = 0;
 double spent_ = 0;
 std::optional<nativeplayback::SourcePosition> stopped_;
public:
 bool begin(uint64_t generation, uint64_t seek, double now,
            int64_t value, int32_t scale) {
  if (active_ || attempts_ >= 2 || spent_ >= 5 || !generation || !seek || !std::isfinite(now) || value < 0 || scale <= 0)
   return false;
  active_ = true; ++attempts_; generation_ = generation; seek_ = seek; began_ = now;
  detectedValue_ = value; detectedScale_ = scale; stopped_.reset();
  return true;
 }
 void cancel() { active_ = false; stopped_.reset(); }
 void finish(double now) { spent_ += now - began_; cancel(); }
 // Only an explicit new user play or a new seek may reset this budget.
 // Automatic resume never resets it; sustained slow supply must fall back.
 void resetBudget() { if (!active_) { attempts_ = 0; spent_ = 0; } }
 bool active() const { return active_; }
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
