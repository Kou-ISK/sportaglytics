#pragma once
#include <array>
#include <cstddef>
#include <cstdint>

namespace appleplayback {
// This is a conservative AVCC classifier, not a complete H.264 validator.
// Unknown/state-bearing NALs return false and retain ordinary decoding.
inline bool pictureTimingOnlySei(const uint8_t *bytes, size_t size) {
  if (!bytes || size < 4 || size > 512 || bytes[0] != 6) return false;
  std::array<uint8_t, 256> rbsp{};
  size_t count = 0;
  unsigned zeros = 0;
  for (size_t i = 1; i < size; ++i) {
    const auto value = bytes[i];
    if (zeros == 2) {
      if (value == 3) {
        if (i + 1 >= size || bytes[i + 1] > 3) return false;
        zeros = 0;
        continue;
      }
      if (value <= 2) return false;
    }
    if (count == rbsp.size()) return false;
    rbsp[count++] = value;
    zeros = value == 0 ? zeros + 1 : 0;
  }
  // Only one picture-scoped timing message, with canonical RBSP termination.
  // Extended sizes, buffering-period and every persistent/unknown SEI decode.
  return count >= 4 && rbsp[0] == 1 && rbsp[1] > 0 && rbsp[1] != 255 &&
    size_t(rbsp[1]) + 3 == count && rbsp[count - 1] == 0x80;
}
inline bool discardableAvcPreroll(const uint8_t *bytes, size_t size, unsigned lengthSize) {
  if (!bytes || !size || size > 4ULL * 1024 * 1024 ||
      (lengthSize != 1 && lengthSize != 2 && lengthSize != 4)) return false;
  size_t cursor = 0, units = 0;
  bool picture = false;
  while (cursor < size) {
    if (++units > 128 || size - cursor < lengthSize) return false;
    uint32_t length = 0;
    for (unsigned i = 0; i < lengthSize; ++i) length = (length << 8) | bytes[cursor++];
    if (!length || length > size - cursor) return false;
    const uint8_t header = bytes[cursor];
    if (header & 0x80) return false;
    const auto type = header & 31, reference = header & 0x60;
    if (type == 1) {
      if (reference || length < 2) return false;
      picture = true;
    } else if (type == 6) {
      if (reference || !pictureTimingOnlySei(bytes + cursor, length)) return false;
    } else if (type == 9) {
      if (reference || length != 2 || (bytes[cursor + 1] & 31) != 16) return false;
    } else if (type == 12) {
      if (reference || length < 2 || bytes[cursor + length - 1] != 0x80) return false;
      for (size_t i = 1; i + 1 < length; ++i) if (bytes[cursor + i] != 0xff) return false;
    } else return false;
    cursor += length;
  }
  return picture;
}
} // namespace appleplayback
