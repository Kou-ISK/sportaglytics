#pragma once
#include <atomic>
#include <cmath>
#include <cstdint>
#include <memory>
#include <optional>
#include <stdexcept>
#include <utility>

namespace appleplayback {
// Pipeline-owned pixel buffers, not an OS/decoder/GPU memory reservation.
struct FrameBudgetState {
  const uint64_t limit;
  std::atomic<uint64_t> used{0};
  std::atomic<uint64_t> quarantined{0};
  explicit FrameBudgetState(uint64_t bytes) : limit(bytes) {}
};
template <typename Image>
using OwnedImage = std::unique_ptr<Image, void (*)(Image *)>;

template <typename Image> class RetainedImage {
  struct Storage {
    std::shared_ptr<FrameBudgetState> budget;
    OwnedImage<Image> image;
    uint64_t bytes;
    mutable std::atomic<bool> unconfirmed{false};
    Storage(std::shared_ptr<FrameBudgetState> owner, OwnedImage<Image> value,
            uint64_t size) noexcept
        : budget(std::move(owner)), image(std::move(value)), bytes(size) {}
    ~Storage() {
      image.reset();
      if (!unconfirmed.load(std::memory_order_relaxed))
        budget->used.fetch_sub(bytes, std::memory_order_relaxed);
    }
  };
  std::shared_ptr<const Storage> storage;
  explicit RetainedImage(std::shared_ptr<const Storage> value) noexcept
      : storage(std::move(value)) {}
  friend class FrameBudget;
public:
  // Borrowed pointer. Consumers keep this lease through GPU/transport drainage,
  // rather than extracting an independently retained, uncharged image owner.
  Image *image() const { return storage ? storage->image.get() : nullptr; }
  // After losing a consumer's release channel, its external image lifetime is
  // unknown. Keep a sticky charge, not an invented completion. Recreating a
  // budget is not a recovery protocol for the outstanding consumer.
  void quarantine() const noexcept {
    if (storage && !storage->unconfirmed.exchange(true, std::memory_order_relaxed))
      storage->budget->quarantined.fetch_add(storage->bytes, std::memory_order_relaxed);
  }
};

template <typename Image> class RetainedFrame {
  RetainedImage<Image> resource;
  uint64_t epoch, sourceGeneration;
  double pts_, end_;
  RetainedFrame(RetainedImage<Image> image, uint64_t operation, uint64_t source,
                double start, double finish) noexcept
      : resource(std::move(image)), epoch(operation), sourceGeneration(source),
        pts_(start), end_(finish) {}
  friend class FrameBudget;
public:
  Image *image() const { return resource.image(); }
  const RetainedImage<Image>& imageLease() const { return resource; }
  double pts() const { return pts_; }
  double end() const { return end_; }
  // Producer provenance, not a presentation operation's authority.
  bool producedBy(uint64_t operation, uint64_t source) const {
    return image() && epoch == operation && sourceGeneration == source;
  }
};

class FrameBudget {
  std::shared_ptr<FrameBudgetState> state;
public:
  explicit FrameBudget(uint64_t bytes)
      : state(std::make_shared<FrameBudgetState>(bytes)) {
    if (!bytes) throw std::invalid_argument("Empty frame buffer budget");
  }
  uint64_t usedBytes() const { return state->used.load(std::memory_order_relaxed); }
  uint64_t quarantinedBytes() const { return state->quarantined.load(std::memory_order_relaxed); }
  uint64_t limitBytes() const { return state->limit; }
  template <typename Image> bool owns(const RetainedImage<Image>& image) const {
    return image.storage && image.storage->budget == state;
  }
  template <typename Image>
  std::optional<RetainedImage<Image>> retainImage(OwnedImage<Image> image,
                                                uint64_t bytes) {
    if (!image || !bytes || quarantinedBytes()) return std::nullopt;
    uint64_t used = state->used.load(std::memory_order_relaxed);
    do {
      if (used > state->limit || bytes > state->limit - used) return std::nullopt;
    } while (!state->used.compare_exchange_weak(used, used + bytes,
                                               std::memory_order_relaxed));
    try {
      return RetainedImage<Image>(
          std::make_shared<typename RetainedImage<Image>::Storage>(
              state, std::move(image), bytes));
    } catch (...) {
      image.reset();
      state->used.fetch_sub(bytes, std::memory_order_relaxed);
      throw;
    }
  }
  template <typename Image>
  std::optional<RetainedFrame<Image>>
  retain(OwnedImage<Image> image, uint64_t epoch, uint64_t sourceGeneration,
         double pts, double end, uint64_t bytes) {
    if (!epoch || !sourceGeneration || !std::isfinite(pts) ||
        !std::isfinite(end) || pts < 0 || end <= pts) return std::nullopt;
    auto resource = retainImage(std::move(image), bytes);
    if (!resource) return std::nullopt;
    return RetainedFrame<Image>(std::move(*resource), epoch, sourceGeneration,
                                pts, end);
  }
};
} // namespace appleplayback
