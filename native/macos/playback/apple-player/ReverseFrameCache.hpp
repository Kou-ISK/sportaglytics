#pragma once
#include <algorithm>
#include <atomic>
#include <cmath>
#include <cstdint>
#include <memory>
#include <optional>
#include <stdexcept>
#include <utility>
#include <vector>

namespace appleplayback {

// Accounting for buffers owned by this pipeline, not an OS memory reservation.
struct FrameBudgetState {
  const uint64_t limit;
  std::atomic<uint64_t> used{0};
  explicit FrameBudgetState(uint64_t bytes) : limit(bytes) {}
};

template <typename Image>
using OwnedImage = std::unique_ptr<Image, void (*)(Image *)>;

template <typename Image> class RetainedFrame {
  struct Storage {
    std::shared_ptr<FrameBudgetState> budget;
    OwnedImage<Image> image;
    uint64_t epoch, sourceGeneration, bytes;
    double pts, end;
    Storage(std::shared_ptr<FrameBudgetState> owner, OwnedImage<Image> value,
            uint64_t operation, uint64_t source, uint64_t size, double start,
            double finish) noexcept
        : budget(std::move(owner)), image(std::move(value)), epoch(operation),
          sourceGeneration(source), bytes(size), pts(start), end(finish) {}
    ~Storage() {
      image.reset();
      budget->used.fetch_sub(bytes, std::memory_order_relaxed);
    }
  };
  std::shared_ptr<const Storage> storage;
  explicit RetainedFrame(std::shared_ptr<const Storage> value) noexcept
      : storage(std::move(value)) {}
  friend class FrameBudget;

public:
  // A renderer keeps the entire lease until GPU/consumer drainage. The pointer
  // is borrowed; extracting/retaining an unaccounted image owner is not
  // allowed.
  Image *image() const { return storage->image.get(); }
  double pts() const { return storage->pts; }
  double end() const { return storage->end; }
  bool belongsTo(uint64_t epoch, uint64_t source) const {
    return storage->epoch == epoch && storage->sourceGeneration == source;
  }
};

class FrameBudget {
  std::shared_ptr<FrameBudgetState> state;

public:
  explicit FrameBudget(uint64_t bytes)
      : state(std::make_shared<FrameBudgetState>(bytes)) {
    if (!bytes)
      throw std::invalid_argument("Empty frame buffer budget");
  }
  uint64_t usedBytes() const {
    return state->used.load(std::memory_order_relaxed);
  }
  uint64_t limitBytes() const { return state->limit; }
  template <typename Image>
  std::optional<RetainedFrame<Image>>
  retain(OwnedImage<Image> image, uint64_t epoch, uint64_t sourceGeneration,
         double pts, double end, uint64_t bytes) {
    if (!image || !epoch || !sourceGeneration || !std::isfinite(pts) ||
        !std::isfinite(end) || pts < 0 || end <= pts || !bytes)
      return std::nullopt;
    uint64_t used = state->used.load(std::memory_order_relaxed);
    do {
      if (used > state->limit || bytes > state->limit - used)
        return std::nullopt;
    } while (!state->used.compare_exchange_weak(used, used + bytes,
                                                std::memory_order_relaxed));
    // GPU/consumer completion can release a lease on another thread. Charges
    // remain atomic even though cache publication/selection uses one actor.
    try {
      return RetainedFrame<Image>(
          std::make_shared<typename RetainedFrame<Image>::Storage>(
              state, std::move(image), epoch, sourceGeneration, bytes, pts,
              end));
    } catch (...) {
      state->used.fetch_sub(bytes, std::memory_order_relaxed);
      throw;
    }
  }
};

// Single actor only. Background decoders return owned leases to that actor;
// stale work is rejected before publishing, not by pretending a decode
// cancelled.
template <typename Image> class ReverseFrameCache {
  uint64_t epoch = 0, sourceGeneration = 0;
  std::vector<RetainedFrame<Image>> frames;

public:
  bool advance(uint64_t operation, uint64_t source) {
    if (!source || operation <= epoch)
      return false;
    epoch = operation;
    sourceGeneration = source;
    frames.clear();
    return true;
  }
  bool publish(std::vector<RetainedFrame<Image>> incoming) {
    if (incoming.empty())
      return false;
    double previous = -1, previousEnd = -1;
    for (const auto &frame : incoming) {
      if (!frame.belongsTo(epoch, sourceGeneration) ||
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
                                             uint64_t operation) const {
    if (operation != epoch || !std::isfinite(sourceTime) || sourceTime < 0)
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
  void clear() { frames.clear(); }
};
} // namespace appleplayback
