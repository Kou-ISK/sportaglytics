#import "DecodedFrameReferenceFixture.hpp"
#import "GroupPlayerPair.hpp"
#include "../surface-transport/GroupSurfaceReceiver.hpp"
#include <unistd.h>

void waitPairAt(STGroupPlayerPair *pair, uint64_t ticks) {
  const double deadline = CACurrentMediaTime() + 8;
  while (CACurrentMediaTime() < deadline && !pair.failed) {
    [pair pollAtGlobalTime:ticks];
    auto available = [pair availableAnchor:ticks];
    if (available && *available == ticks) return;
    pump();
  }
  assert(false);
}
void stoppedPublicationKeepsItsActualSurface(NSString *directory) {
  auto url = [NSURL fileURLWithPath:[directory stringByAppendingPathComponent:@"published-stop-pair.mov"]];
  fixture(url, true, 1920, 1080, -1, false, 80);
  const auto revision = *appleplayback::sourceFileRevision(url);
  appleplayback::FrameBudget budget(512ULL * 1024 * 1024);
  auto service = [@"local.sportaglytics.surface.pinned-" stringByAppendingString:NSUUID.UUID.UUIDString];
  GroupSurfaceReceiver receiver; receiver.open(service.UTF8String); receiver.setPeer(getpid());
  GroupSurfaceSender sender(budget); sender.open(service.UTF8String, getpid());
  auto pair = [[STGroupPlayerPair alloc] initWithURLs:@[url, url] placements:
    (std::array<appleplayback::GroupClipPlacement, 2>{{{0, 1, 0, 240240, 0, revision}, {1, 1, 0, 238238, 2002, revision}}}) budget:budget];
  assert([pair seek:180000 operation:1]); waitPairAt(pair, 180000);
  assert(([pair publish:{1, 1, 1, 180000} sender:sender]));
  auto a = receiver.poll(), b = receiver.poll(); assert(a && b);
  const auto firstSurface = IOSurfaceGetID(a->surface), secondSurface = IOSurfaceGetID(b->surface);
  const auto firstIdentity = a->identity, secondIdentity = b->identity;
  receiver.drawn(firstIdentity.id); receiver.drawn(secondIdentity.id); sender.poll();
  // Keep the real receiver loans until comparison, preventing allocator reuse
  // of an old surface ID from making a new decode look like the same image.
  waitPairAt(pair, 4004); waitPairAt(pair, 90000); // three disjoint real image banks
  const groupsurfacewire::StopProof proof{1, 1, 1, 180000, firstIdentity.id, secondIdentity.id};
  const auto stopped = sender.stopAnchor(proof, 2, 1);
  assert([pair seek:stopped operation:2 publishedPair:proof.pair]); waitPairAt(pair, stopped);
  assert(([pair publish:{2, 1, 2, stopped} sender:sender]));
  auto stoppedA = receiver.poll(), stoppedB = receiver.poll(); assert(stoppedA && stoppedB);
  assert(IOSurfaceGetID(stoppedA->surface) == firstSurface && IOSurfaceGetID(stoppedB->surface) == secondSurface);
  assert(stoppedA->identity.sourcePTS == firstIdentity.sourcePTS && stoppedA->identity.sourceEndPTS == firstIdentity.sourceEndPTS);
  assert(stoppedB->identity.sourcePTS == secondIdentity.sourcePTS && stoppedB->identity.sourceEndPTS == secondIdentity.sourceEndPTS);
  assert(stoppedA->identity.globalTicks == stopped && stoppedB->identity.globalTicks == stopped);
  receiver.drawn(stoppedA->identity.id); receiver.drawn(stoppedB->identity.id); sender.poll();
  [pair close]; const double deadline = CACurrentMediaTime() + 4;
  while (!pair.drained && CACurrentMediaTime() < deadline) pump();
  assert(pair.drained && sender.pending() == 4 && budget.usedBytes() > 0);
  const auto retained = budget.usedBytes();
  receiver.release(firstIdentity.id); receiver.release(secondIdentity.id); sender.poll();
  assert(sender.pending() == 2 && budget.usedBytes() == retained); // shared, not double charged/refunded
  receiver.release(stoppedA->identity.id); receiver.release(stoppedB->identity.id); sender.poll();
  assert(!sender.pending() && !budget.usedBytes() && !budget.quarantinedBytes());
  receiver.close();
}
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
    (std::array<appleplayback::GroupClipPlacement, 2>{{{0, 1, 0, 24024, 0, *appleplayback::sourceFileRevision(url)}, {1, 1, 0, 22022, 2002, *appleplayback::sourceFileRevision(url)}}}) budget:budget];
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
  // JPEG coded components are checked here; production colour qualification
  // remains a separate Main/profile gate, not this injected fixture plan.
  assert(IOSurfaceLock(a->surface, kIOSurfaceLockReadOnly, nullptr) == kIOReturnSuccess);
  assert(IOSurfaceLock(b->surface, kIOSurfaceLockReadOnly, nullptr) == kIOReturnSuccess);
  const auto yA = *(static_cast<const uint8_t *>(IOSurfaceGetBaseAddressOfPlane(a->surface, 0)));
  const auto yB = *(static_cast<const uint8_t *>(IOSurfaceGetBaseAddressOfPlane(b->surface, 0)));
  assert(yA == referenceComponent(directory, 1920, 1080, 60));
  assert(yB == referenceComponent(directory, 1920, 1080, 80));
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
  stoppedPublicationKeepsItsActualSurface(directory);
  assert([[NSFileManager defaultManager] removeItemAtPath:directory error:nil]);
  puts("real AVPlayer -> actual sample intervals -> shared lease -> group Mach pair -> stop fence -> release passed");
} }
