#pragma once
#include <CommonCrypto/CommonDigest.h>
#include <CoreVideo/CoreVideo.h>
#include <array>
#include <cstdint>
#include <optional>

namespace playbackdiagnostic {
using ActivePixelDigest = std::array<unsigned char, CC_SHA256_DIGEST_LENGTH>;

// Diagnostic only: hash both active NV12 planes, never allocator row padding.
// This is pixel identity, not a source/operation authorization or display ACK.
inline std::optional<ActivePixelDigest> activeNV12Digest(CVPixelBufferRef image) {
  if (!image) return std::nullopt;
  const auto format = CVPixelBufferGetPixelFormatType(image);
  const size_t width = CVPixelBufferGetWidth(image), height = CVPixelBufferGetHeight(image);
  if ((format != kCVPixelFormatType_420YpCbCr8BiPlanarVideoRange &&
       format != kCVPixelFormatType_420YpCbCr8BiPlanarFullRange) ||
      !width || width > 4096 || !height || height > 2160 ||
      !CVPixelBufferIsPlanar(image) || CVPixelBufferGetPlaneCount(image) != 2 ||
      CVPixelBufferLockBaseAddress(image, kCVPixelBufferLock_ReadOnly) != kCVReturnSuccess)
    return std::nullopt;
  struct Lock {
    CVPixelBufferRef image;
    ~Lock() { if (image) CVPixelBufferUnlockBaseAddress(image, kCVPixelBufferLock_ReadOnly); }
    bool finish() {
      const auto value = image; image = nullptr;
      return CVPixelBufferUnlockBaseAddress(value, kCVPixelBufferLock_ReadOnly) == kCVReturnSuccess;
    }
  } lock{image};
  CC_SHA256_CTX context;
  const std::array<uint64_t, 3> shape{format, width, height};
  if (CC_SHA256_Init(&context) != 1 ||
      CC_SHA256_Update(&context, shape.data(), sizeof(shape)) != 1)
    return std::nullopt;
  for (size_t plane = 0; plane < 2; ++plane) {
    const size_t expectedWidth = plane ? (width + 1) / 2 : width;
    const size_t expectedHeight = plane ? (height + 1) / 2 : height;
    const size_t activeBytes = expectedWidth * (plane ? 2 : 1);
    const size_t stride = CVPixelBufferGetBytesPerRowOfPlane(image, plane);
    const auto *base = static_cast<const unsigned char *>(CVPixelBufferGetBaseAddressOfPlane(image, plane));
    if (!base || CVPixelBufferGetWidthOfPlane(image, plane) != expectedWidth ||
        CVPixelBufferGetHeightOfPlane(image, plane) != expectedHeight ||
        stride < activeBytes || stride > 1048576)
      return std::nullopt;
    for (size_t row = 0; row < expectedHeight; ++row)
      if (CC_SHA256_Update(&context, base + row * stride, static_cast<CC_LONG>(activeBytes)) != 1)
        return std::nullopt;
  }
  ActivePixelDigest result{};
  if (CC_SHA256_Final(result.data(), &context) != 1 || !lock.finish()) return std::nullopt;
  return result;
}
} // namespace playbackdiagnostic
