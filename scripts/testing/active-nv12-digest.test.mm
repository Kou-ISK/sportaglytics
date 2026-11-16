#import <Foundation/Foundation.h>
#include "active-nv12-digest.hpp"
#include <cassert>
#include <cstring>

static CVPixelBufferRef make(size_t width, size_t height, OSType format) {
  CVPixelBufferRef image = nullptr;
  NSDictionary *attributes = @{(id)kCVPixelBufferBytesPerRowAlignmentKey: @64};
  assert(CVPixelBufferCreate(nullptr, width, height, format,
      (__bridge CFDictionaryRef)attributes, &image) == kCVReturnSuccess);
  assert(image);
  return image;
}
static void fill(CVPixelBufferRef image, bool paddingOnly) {
  assert(CVPixelBufferLockBaseAddress(image, 0) == kCVReturnSuccess);
  for (size_t plane = 0; plane < 2; ++plane) {
    const size_t active = CVPixelBufferGetWidthOfPlane(image, plane) * (plane ? 2 : 1);
    const size_t stride = CVPixelBufferGetBytesPerRowOfPlane(image, plane);
    assert(stride > active); // synthetic fixture intentionally has row padding
    auto *base = static_cast<unsigned char *>(CVPixelBufferGetBaseAddressOfPlane(image, plane));
    for (size_t row = 0; row < CVPixelBufferGetHeightOfPlane(image, plane); ++row) {
      if (!paddingOnly) std::memset(base + row * stride, 0x23, active);
      std::memset(base + row * stride + active, paddingOnly ? 0xab : 0x44, stride - active);
    }
  }
  assert(CVPixelBufferUnlockBaseAddress(image, 0) == kCVReturnSuccess);
}
static void change(CVPixelBufferRef image, size_t plane, size_t byte) {
  assert(CVPixelBufferLockBaseAddress(image, 0) == kCVReturnSuccess);
  auto *base = static_cast<unsigned char *>(CVPixelBufferGetBaseAddressOfPlane(image, plane));
  base[byte] ^= 1;
  assert(CVPixelBufferUnlockBaseAddress(image, 0) == kCVReturnSuccess);
}
int main() { @autoreleasepool {
  using playbackdiagnostic::activeNV12Digest;
  auto image = make(8, 4, kCVPixelFormatType_420YpCbCr8BiPlanarVideoRange);
  fill(image, false);
  const auto baseline = activeNV12Digest(image); assert(baseline);
  fill(image, true); assert(activeNV12Digest(image) == baseline);
  change(image, 0, 1); assert(activeNV12Digest(image) != baseline); // missed by sparse 97-byte sampling
  change(image, 0, 1); assert(activeNV12Digest(image) == baseline);
  change(image, 1, 0); assert(activeNV12Digest(image) != baseline); // chroma-only change
  auto shape = make(4, 8, kCVPixelFormatType_420YpCbCr8BiPlanarVideoRange);
  fill(shape, false); assert(activeNV12Digest(shape) != baseline);
  auto range = make(8, 4, kCVPixelFormatType_420YpCbCr8BiPlanarFullRange);
  fill(range, false); assert(activeNV12Digest(range) != baseline);
  auto bgra = make(8, 4, kCVPixelFormatType_32BGRA);
  assert(!activeNV12Digest(bgra)); assert(!activeNV12Digest(nullptr));
  CVPixelBufferRelease(bgra); CVPixelBufferRelease(range);
  CVPixelBufferRelease(shape); CVPixelBufferRelease(image);
} }
