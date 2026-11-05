#pragma once
#include <CoreVideo/CoreVideo.h>
#include <utility>

// Hold the pixel buffer itself: retaining only IOSurface does not prevent
// CVPixelBufferPool from reusing the storage while the consumer still draws it.
class PixelReference {
  CVPixelBufferRef value_;
  struct Adopt {};
  PixelReference(CVPixelBufferRef owned, Adopt) noexcept : value_(owned) {}
public:
  static PixelReference adopt(CVPixelBufferRef owned) noexcept {
    return PixelReference(owned, Adopt{});
  }
  explicit PixelReference(CVPixelBufferRef borrowed) noexcept
      : value_(CVPixelBufferRetain(borrowed)) {}
  ~PixelReference() { CVPixelBufferRelease(value_); }
  PixelReference(const PixelReference&) = delete;
  PixelReference& operator=(const PixelReference&) = delete;
  PixelReference(PixelReference&& other) noexcept
      : value_(std::exchange(other.value_, nullptr)) {}
  PixelReference& operator=(PixelReference&& other) noexcept {
    if (this != &other) {
      CVPixelBufferRelease(value_);
      value_ = std::exchange(other.value_, nullptr);
    }
    return *this;
  }
};
