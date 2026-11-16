#import "../../native/macos/playback/apple-player/SampleIntervalFixture.hpp"
int main(int argc, const char **argv) { @autoreleasepool {
  if (argc != 2) return 2;
  fixture([NSURL fileURLWithPath:@(argv[1])], true, 1920, 1080);
  return 0;
} }
