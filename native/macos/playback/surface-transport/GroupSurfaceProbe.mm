#include "GroupSurfaceSender.hpp"
#import <Foundation/Foundation.h>
#include <chrono>
#include <cstdio>
#include <cstdlib>
#include <fcntl.h>
#include <thread>
#include <unistd.h>

// Owned, finite synthetic peer for the real Main-addon contract test. No media,
// app UI, network listener or process inventory is used.
int main(int argc, const char** argv) { @autoreleasepool {
  if (argc != 3) return 2;
  char* end = nullptr; long peer = strtol(argv[2], &end, 10);
  if (!end || *end || peer <= 0 || peer > INT32_MAX) return 2;
  if (fcntl(STDIN_FILENO, F_SETFL, fcntl(STDIN_FILENO, F_GETFL) | O_NONBLOCK)) return 2;
  try {
    using Pixel = std::remove_pointer_t<CVPixelBufferRef>;
    appleplayback::FrameBudget budget(64ULL * 1024 * 1024);
    std::array<std::optional<appleplayback::RetainedImage<Pixel>>, 2> images;
    for (auto& image : images) {
      CVPixelBufferRef value = nullptr;
      NSDictionary* attrs = @{(id)kCVPixelBufferIOSurfacePropertiesKey: @{}};
      if (CVPixelBufferCreate(nullptr, 1920, 1080, kCVPixelFormatType_420YpCbCr8BiPlanarVideoRange,
          (__bridge CFDictionaryRef)attrs, &value) != kCVReturnSuccess) return 1;
      auto bytes = CVPixelBufferGetDataSize(value);
      image = budget.retainImage(appleplayback::OwnedImage<Pixel>(value,
        [](Pixel* p) { CVPixelBufferRelease(p); }), bytes);
      if (!image) return 1;
    }
    GroupSurfaceSender sender(budget); sender.open(argv[1], pid_t(peer));
    for (uint64_t pair = 1; pair <= 2; ++pair) {
      std::array<groupsurfacewire::Identity, 2> values;
      for (uint64_t angle = 0; angle < 2; ++angle)
        values[angle] = {0, pair, 1, pair, angle, pair, angle,
          2400000 + angle * 60000, 2402002 + angle * 60000,
          2400000, 2400000, 2402002, groupsurfacewire::Content::Image};
      if (!sender.sendPair({*images[0], *images[1]}, values)) return 1;
      printf("{\"pairSent\":%llu}\n", static_cast<unsigned long long>(pair)); fflush(stdout);
    }
    auto deadline = std::chrono::steady_clock::now() + std::chrono::seconds(6);
    while (sender.pending() && std::chrono::steady_clock::now() < deadline) {
      char input; if (read(STDIN_FILENO, &input, 1) > 0 && input == 'q') return 1;
      sender.poll(); std::this_thread::sleep_for(std::chrono::milliseconds(2));
    }
    if (sender.pending()) return 1;
    auto left = sender.drawn(0), right = sender.drawn(1);
    if (!left || !right || left->id != 3 || right->id != 4) return 1;
    for (auto& image : images) image.reset();
    if (budget.usedBytes() || budget.quarantinedBytes()) return 1;
    puts("{\"drained\":true,\"heldBytes\":0,\"lastDrawn\":[3,4]}"); return 0;
  } catch (const std::exception& error) {
    fprintf(stderr, "%s\n", error.what()); return 1;
  }
} }
