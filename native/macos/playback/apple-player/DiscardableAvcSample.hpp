#pragma once
#include "DiscardableAvcPreroll.hpp"
#import <CoreMedia/CoreMedia.h>
#include <vector>

namespace appleplayback {
// Call only after the normal sample timing, format and full-sync checks.
// No sample/codec attachments are rewritten, and required pictures never skip.
inline bool discardableAvcSample(CMSampleBufferRef sample) {
  if (!sample || !CMSampleBufferDataIsReady(sample) || CMSampleBufferGetNumSamples(sample) != 1)
    return false;
  if (CMGetAttachment(sample, kCMSampleBufferAttachmentKey_ResetDecoderBeforeDecoding, nullptr) ||
      CMGetAttachment(sample, kCMSampleBufferAttachmentKey_DrainAfterDecoding, nullptr)) return false;
  auto format = CMSampleBufferGetFormatDescription(sample);
  if (!format || CMFormatDescriptionGetMediaType(format) != kCMMediaType_Video ||
      CMFormatDescriptionGetMediaSubType(format) != kCMVideoCodecType_H264) return false;
  int lengthSize = 0;
  if (CMVideoFormatDescriptionGetH264ParameterSetAtIndex(format, 0, nullptr, nullptr,
      nullptr, &lengthSize) != noErr) return false;
  auto block = CMSampleBufferGetDataBuffer(sample);
  const size_t size = CMSampleBufferGetTotalSampleSize(sample);
  if (!block || !size || size > 4ULL * 1024 * 1024 || CMBlockBufferGetDataLength(block) != size)
    return false;
  char *bytes = nullptr;
  size_t contiguous = 0, total = 0;
  if (CMBlockBufferGetDataPointer(block, 0, &contiguous, &total, &bytes) == noErr &&
      bytes && contiguous == size && total == size)
    return discardableAvcPreroll(reinterpret_cast<const uint8_t *>(bytes), size, lengthSize);
  // A fragmented block is copied within the existing per-packet 4 MiB bound.
  // Allocation failure is handled by the worker's existing bounded-failure path.
  std::vector<uint8_t> copy(size);
  if (CMBlockBufferCopyDataBytes(block, 0, size, copy.data()) != kCMBlockBufferNoErr) return false;
  return discardableAvcPreroll(copy.data(), copy.size(), lengthSize);
}
} // namespace appleplayback
