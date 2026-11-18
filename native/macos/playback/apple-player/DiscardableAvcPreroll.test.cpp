#include "DiscardableAvcPreroll.hpp"
#include <cassert>
#include <cstdio>
#include <vector>
using Bytes = std::vector<uint8_t>;
Bytes avcc(const std::vector<Bytes> &nals, unsigned prefix = 4) {
  Bytes bytes;
  for (const auto &nal : nals) {
    for (unsigned i = prefix; i > 0; --i) bytes.push_back(uint8_t(nal.size() >> (8 * (i - 1))));
    bytes.insert(bytes.end(), nal.begin(), nal.end());
  }
  return bytes;
}
bool classified(const std::vector<Bytes> &nals, unsigned prefix = 4) {
  const auto bytes = avcc(nals, prefix);
  return appleplayback::discardableAvcPreroll(bytes.data(), bytes.size(), prefix);
}
int main() {
  for (unsigned prefix : {1u, 2u, 4u}) {
    assert(classified({{9, 0x10}, {1, 0xb8}, {12, 0xff, 0x80}}, prefix));
    // Two complementary non-reference field access units remain picture-scoped.
    assert(classified({{9, 0x10}, {6, 1, 3, 0, 0, 3, 0, 0x80}, {1, 0xb8},
      {9, 0x10}, {6, 1, 1, 0x10, 0x80}, {1, 0xb8}}, prefix));
    for (uint8_t header : {0x21, 0x41, 0x61, 0x81, 5, 7, 8, 10, 11, 14, 0})
      assert(!classified({{1, 0xb8}, {header, 0xb8}}, prefix));
    assert(!classified({{9, 0x10}, {12, 0x80}}, prefix));
    assert(!classified({{1}}, prefix));
    assert(!classified({{9, 0x11}, {1, 0xb8}}, prefix));
    assert(!classified({{12, 0, 0x80}, {1, 0xb8}}, prefix));
    auto bytes = avcc({{1, 0xb8}}, prefix);
    bytes.push_back(0);
    assert(!appleplayback::discardableAvcPreroll(bytes.data(), bytes.size(), prefix));
    bytes = avcc({{1, 0xb8}}, prefix);
    bytes[prefix - 1] = 255;
    assert(!appleplayback::discardableAvcPreroll(bytes.data(), bytes.size(), prefix));
    bytes.assign(prefix, 0);
    assert(!appleplayback::discardableAvcPreroll(bytes.data(), bytes.size(), prefix));
  }
  for (uint8_t type : {0, 5, 45, 137})
    assert(!classified({{6, type, 1, 0, 0x80}, {1, 0xb8}}));
  for (const auto &sei : std::vector<Bytes>{{6, 1, 3, 0, 0, 3, 4, 0x80},
       {6, 1, 3, 0, 0, 0, 0x80}, {6, 1, 1, 0, 0}, {6, 1, 255, 0, 0x80},
       {6, 1, 1, 0, 1, 1, 0, 0x80}, {6, 1, 0, 0x80, 0}, {6, 1, 1, 0, 3, 0x80}})
    assert(!classified({sei, {1, 0xb8}}));
  assert(!classified({{6, 1, 0, 0x80}, {1, 0xb8}}));
  assert(!classified(std::vector<Bytes>(129, Bytes{1, 0xb8})));
  Bytes huge(4 * 1024 * 1024 + 1, 0);
  assert(!appleplayback::discardableAvcPreroll(huge.data(), huge.size(), 4));
  assert(!appleplayback::discardableAvcPreroll(nullptr, 1, 4));
  assert(!appleplayback::discardableAvcPreroll(huge.data(), 1, 3));
  // Deterministic malformed-input smoke coverage under ASan/UBSan as well.
  uint32_t seed = 0x5a17c3u;
  for (unsigned attempt = 0; attempt < 5000; ++attempt) {
    Bytes input(attempt % 1024);
    for (auto &byte : input) { seed = seed * 1664525u + 1013904223u; byte = uint8_t(seed >> 24); }
    for (unsigned prefix : {1u, 2u, 4u})
      (void)appleplayback::discardableAvcPreroll(input.data(), input.size(), prefix);
  }
  puts("AVC unwanted-picture classifier: references, field pairs, SEI, malformed and bounded input passed");
}
