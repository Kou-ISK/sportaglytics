#pragma once
#include "../frame-ownership/FrameLease.hpp"
#include <algorithm>
#include <vector>

namespace appleplayback {
// Single actor only. Decode requests and playback/presentation operations are
// separate. Completed immutable samples can survive a new request for the same
// validated source; an old producer callback still cannot replace the bank.
template <typename Image> class ReverseFrameCache {
  uint64_t epoch = 0, sourceGeneration = 0;
  bool requestActive = false;
  std::vector<RetainedFrame<Image>> frames;

public:
  bool beginRequest(uint64_t request, uint64_t source) {
    if (!source || request <= epoch)
      return false;
    if (source != sourceGeneration)
      frames.clear();
    epoch = request;
    sourceGeneration = source;
    requestActive = true;
    return true;
  }
  bool cancelRequest(uint64_t request) {
    if (!requestActive || request != epoch)
      return false;
    requestActive = false;
    return true;
  }
  bool publish(std::vector<RetainedFrame<Image>> incoming) {
    if (!requestActive || incoming.empty())
      return false;
    double previous = -1, previousEnd = -1;
    for (const auto &frame : incoming) {
      if (!frame.producedBy(epoch, sourceGeneration) ||
          frame.pts() <= previous || frame.pts() < previousEnd)
        return false;
      previous = frame.pts();
      previousEnd = frame.end();
    }
    // All-or-nothing handoff. External leases keep their budget charge after
    // replacing/clearing a chunk, until the actual consumer releases them.
    frames = std::move(incoming);
    return true;
  }
  std::optional<RetainedFrame<Image>> select(double sourceTime,
                                           uint64_t request) const {
    if (!requestActive || request != epoch || !std::isfinite(sourceTime) ||
        sourceTime < 0)
      return std::nullopt;
    auto next =
        std::upper_bound(frames.begin(), frames.end(), sourceTime,
                         [](double time, const RetainedFrame<Image> &frame) {
                           return time < frame.pts();
                         });
    if (next == frames.begin())
      return std::nullopt;
    const auto &frame = *--next;
    // A gap or an exact exclusive end is not a held frame of a different clip.
    return sourceTime < frame.end() ? std::optional<RetainedFrame<Image>>(frame)
                                    : std::nullopt;
  }
  // Published intervals are sorted and non-overlapping. A sampled hole
  // splits the usable span, even if later frames are already present.
  std::optional<std::pair<double, double>> contiguousSpan(double time, uint64_t request) const {
    if (!select(time, request)) return std::nullopt;
    double start = frames.front().pts(), end = start;
    for (const auto &frame : frames) {
      if (frame.pts() != end) {
        if (time < end) break;
        start = frame.pts();
      }
      end = frame.end();
    }
    return std::pair{start, end};
  }
  // Eviction only. Cancellation must carry the matching request identity;
  // an old cancellation cannot revoke a new request's publication authority.
  bool retainIntersecting(double start, double end) {
    frames.erase(std::remove_if(frames.begin(), frames.end(), [start, end](const auto &frame) {
      return frame.end() <= start || frame.pts() >= end;
    }), frames.end());
    return !frames.empty();
  }
  void clear() { frames.clear(); }
};
} // namespace appleplayback
