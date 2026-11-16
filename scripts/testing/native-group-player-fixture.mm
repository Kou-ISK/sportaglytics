#import "../../native/macos/playback/apple-player/SampleIntervalFixture.hpp"
#include <string>
int main(int argc, const char **argv) { @autoreleasepool {
  if (argc != 2 && !(argc == 3 && std::string(argv[2]) == "long")) return 2;
  fixture([NSURL fileURLWithPath:@(argv[1])], true, 1920, 1080, -1, false, argc == 3 ? 120 : 8);
  return 0;
} }
