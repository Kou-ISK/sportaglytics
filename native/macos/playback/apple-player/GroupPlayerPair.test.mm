#import "SampleIntervalFixture.hpp"
#import "GroupPlayerPair.hpp"
#include "../surface-transport/GroupSurfaceReceiver.hpp"
#include <unistd.h>

int main() { @autoreleasepool {
  NSString *directory = [NSTemporaryDirectory() stringByAppendingPathComponent:
    [@"sportag-group-pair-" stringByAppendingString:NSUUID.UUID.UUIDString]];
  assert([[NSFileManager defaultManager] createDirectoryAtPath:directory withIntermediateDirectories:NO attributes:nil error:nil]);
  NSURL *url = [NSURL fileURLWithPath:[directory stringByAppendingPathComponent:@"vfr.mov"]];
  fixture(url, true, 1920, 1080);
  appleplayback::FrameBudget budget(64 * 1024 * 1024);
  NSString *service = [@"local.sportaglytics.surface.pair-" stringByAppendingString:NSUUID.UUID.UUIDString];
  GroupSurfaceReceiver receiver; receiver.open(service.UTF8String); receiver.setPeer(getpid());
  GroupSurfaceSender sender(budget); sender.open(service.UTF8String, getpid());
  auto pair = [[STGroupPlayerPair alloc] initWithURLs:@[url, url] placements:
    (std::array<appleplayback::GroupClipPlacement, 2>{{{0, 1, 0, 24024, 0}, {1, 1, 0, 22022, 2002}}}) budget:budget];
  assert(![pair seek:23000 operation:1]); // invalid second placement changes neither
  assert([pair seek:4004 operation:1]);
  bool sent = false; double deadline = CACurrentMediaTime() + 12;
  while (!sent && !pair.failed && CACurrentMediaTime() < deadline) {
    [pair poll]; sent = [pair publish:{1, 1, 1, 4004} sender:sender]; pump();
  }
  assert(sent && !pair.failed && sender.pending() == 2);
  // Moving an anchor inside the same two samples is not a new image. Do not
  // let synthetic clock movement satisfy the reverse image-progress watchdog.
  assert((![pair publish:{1, 1, 2, 4005} sender:sender]));
  assert(sender.pending() == 2);
  auto a = receiver.poll(), b = receiver.poll();
  assert(a && b && a->identity.globalTicks == 4004 && b->identity.globalTicks == 4004);
  assert(a->identity.sourcePTS == 2002 && b->identity.sourcePTS == 6006);
  assert(a->identity.globalStart == 2002 && b->identity.globalStart == 4004);
  // Distinct per-sample fixture images prove these two timestamps refer to
  // different decoded content, rather than merely two clocks/buffer handles.
  assert(IOSurfaceLock(a->surface, kIOSurfaceLockReadOnly, nullptr) == kIOReturnSuccess);
  assert(IOSurfaceLock(b->surface, kIOSurfaceLockReadOnly, nullptr) == kIOReturnSuccess);
  const auto yA = *(static_cast<const uint8_t *>(IOSurfaceGetBaseAddressOfPlane(a->surface, 0)));
  const auto yB = *(static_cast<const uint8_t *>(IOSurfaceGetBaseAddressOfPlane(b->surface, 0)));
  assert(std::abs(int(yA) - int(std::lround(16 + 60 * 219.0 / 255))) <= 4);
  assert(std::abs(int(yB) - int(std::lround(16 + 80 * 219.0 / 255))) <= 4);
  assert(yB > yA + 8);
  assert(IOSurfaceUnlock(a->surface, kIOSurfaceLockReadOnly, nullptr) == kIOReturnSuccess);
  assert(IOSurfaceUnlock(b->surface, kIOSurfaceLockReadOnly, nullptr) == kIOReturnSuccess);
  // Stop proof is checked against the actual sender-assigned IDs before any
  // Drawn ACK; a requested/player clock never authorizes the stopped anchor.
  groupsurfacewire::StopProof proof{1, 1, 1, 4004, a->identity.id, b->identity.id};
  assert(sender.stopAnchor(proof, 2, 1) == 4004);
  bool rejected = false;
  try { auto forged = proof; ++forged.globalTicks; sender.stopAnchor(forged, 2, 1); }
  catch (const std::exception &) { rejected = true; } assert(rejected);
  receiver.drawn(a->identity.id); receiver.drawn(b->identity.id); sender.poll();
  auto drawnA = sender.drawn(0), drawnB = sender.drawn(1);
  assert(drawnA && drawnB && drawnA->pair == 1 && drawnB->pair == 1);
  // Closing the producer cannot refund loans while the receiver still owns them.
  [pair close]; deadline = CACurrentMediaTime() + 4;
  while (!pair.drained && CACurrentMediaTime() < deadline) pump();
  assert(pair.drained && budget.usedBytes() > 0 && sender.pending() == 2);
  receiver.release(a->identity.id); receiver.release(b->identity.id); sender.poll();
  assert(sender.pending() == 0 && budget.usedBytes() == 0 && !budget.quarantinedBytes());
  receiver.close();
  assert([[NSFileManager defaultManager] removeItemAtPath:directory error:nil]);
  puts("real AVPlayer -> actual sample intervals -> shared lease -> group Mach pair -> stop fence -> release passed");
} }
