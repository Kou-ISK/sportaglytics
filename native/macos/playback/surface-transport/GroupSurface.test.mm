#include "GroupSurfaceSender.hpp"
#include "GroupSurfaceReceiver.hpp"
#import <Foundation/Foundation.h>
#include <cassert>
#include <string>
#include <unistd.h>

namespace {
using Pixel = std::remove_pointer_t<CVPixelBufferRef>;
using Lease = appleplayback::RetainedImage<Pixel>;
template<class F> void fails(F work, const char* expected) {
  try { work(); assert(false); }
  catch (const std::runtime_error& error) { assert(std::string(error.what()) == expected); }
}
CVPixelBufferRef pixel() {
  CVPixelBufferRef value = nullptr;
  NSDictionary* attrs = @{(id)kCVPixelBufferIOSurfacePropertiesKey: @{}};
  assert(CVPixelBufferCreate(nullptr, 1920, 1080, kCVPixelFormatType_420YpCbCr8BiPlanarVideoRange,
    (__bridge CFDictionaryRef)attrs, &value) == kCVReturnSuccess);
  assert(value && CVPixelBufferGetIOSurface(value)); return value;
}
Lease image(appleplayback::FrameBudget& budget) {
  auto value = pixel(); auto bytes = CVPixelBufferGetDataSize(value);
  auto lease = budget.retainImage(appleplayback::OwnedImage<Pixel>(value,
    [](Pixel* p){ CVPixelBufferRelease(p); }), bytes);
  assert(lease); return std::move(*lease);
}
std::string service() {
  static size_t serial = 0;
  return "local.sportaglytics.surface.group-test-" + std::to_string(getpid()) + "-" + std::to_string(++serial);
}
groupsurfacewire::Identity identity(size_t angle, uint64_t epoch, uint64_t operation, uint64_t global) {
  return {0, operation, 1, operation, angle, epoch, angle, global + angle * 60000,
    global + angle * 60000 + 2002, global, global, global + 2002, groupsurfacewire::Content::Image};
}
void pairReplacementAndGlobalCredit() {
  appleplayback::FrameBudget budget(64ULL * 1024 * 1024);
  std::array<Lease, 2> leases{image(budget), image(budget)};
  const auto bytes = budget.usedBytes();
  assert(CVPixelBufferGetIOSurface(leases[0].image()) != CVPixelBufferGetIOSurface(leases[1].image()));
  auto name = service(); GroupSurfaceReceiver receiver; receiver.open(name.c_str()); receiver.setPeer(getpid());
  GroupSurfaceSender sender(budget); sender.open(name.c_str(), getpid());
  for (size_t i = 0; i < 3; ++i) {
    std::array<groupsurfacewire::Identity, 2> pair{identity(0, i ? 2 : 1, i ? 2 : 1, 1000 + i), identity(1, i ? 2 : 1, i ? 2 : 1, 1000 + i)};
    for (auto& value : pair) value.pair = i + 1;
    assert(sender.sendPair(leases, pair));
  }
  assert(sender.pending() == 6 && budget.usedBytes() == bytes);
  // The input target is not a displayed clock. A complete published pair can
  // validate a preload fence before its delayed Drawn ACKs, without guessing.
  assert(sender.stopAnchor({1, 1, 1, 1000, 1, 2}, 3, 1) == 1000);
  fails([&]{sender.stopAnchor({1, 1, 1, 1001, 1, 2}, 3, 1);}, "group stop pair mismatch");
  fails([&]{sender.stopAnchor({1, 1, 1, 1000, 1, 4}, 3, 1);}, "group stop pair mismatch");
  fails([&]{sender.stopAnchor({1, 1, 1, 1000, 1, 2}, 3, 2);}, "invalid group stop owner");
  fails([&]{sender.stopAnchor({1, 1, 1, 1000, 1, 2}, 1, 1);}, "invalid group stop owner");
  fails([&]{sender.stopAnchor({1, 1, 1, 1000, 1, 2}, 2, 1);}, "invalid group stop owner");
  fails([&]{receiver.close();}, "unread group surface packets");
  std::array<groupsurfacewire::Identity, 2> blocked{identity(0, 2, 2, 2000), identity(1, 2, 2, 2000)};
  for (auto& value : blocked) value.pair = 4;
  assert(!sender.sendPair(leases, blocked) && sender.nextID() == 7);
  for (size_t i = 0; i < 6; ++i) {
    auto frame = receiver.poll(); assert(frame && frame->identity.id == i + 1);
    assert(frame->identity.angle == i % 2 && frame->identity.globalTicks == 1000 + i / 2);
    assert(IOSurfaceGetID(frame->surface) == IOSurfaceGetID(CVPixelBufferGetIOSurface(leases[i % 2].image())));
  }
  assert(receiver.count() == 6 && !receiver.poll());
  // New pair can arrive while old pair is still held; late old Drawn cannot
  // overwrite the newer source/display identity of either angle.
  receiver.drawn(3); receiver.drawn(4); receiver.drawn(1); receiver.drawn(2); sender.poll();
  assert(sender.drawn(0)->id == 3 && sender.drawn(1)->id == 4);
  assert(sender.drawn(0)->sourceEpoch == 2 && sender.drawn(1)->operation == 2);
  fails([&]{sender.stopAnchor({1, 1, 1, 1000, 1, 2}, 3, 1);}, "group stop pair stale");
  receiver.release(1); sender.poll();
  assert(sender.pending() == 5 && !sender.sendPair(leases, blocked) && sender.nextID() == 7);
  for (size_t i = 2; i <= 6; ++i) receiver.release(i); // also cancellation before Drawn
  sender.poll(); assert(sender.pending() == 0 && receiver.count() == 0);
  assert(sender.stopAnchor({2, 1, 2, 1001, 3, 4}, 3, 1) == 1001);
  assert(budget.usedBytes() == bytes && budget.quarantinedBytes() == 0);
  receiver.close();
}
void invalidIdentityHasNoSideEffects() {
  appleplayback::FrameBudget budget(64ULL * 1024 * 1024); auto lease = image(budget);
  auto name = service(); GroupSurfaceReceiver receiver; receiver.open(name.c_str()); receiver.setPeer(getpid());
  GroupSurfaceSender sender(budget); sender.open(name.c_str(), getpid());
  for (int item = 0; item < 9; ++item) {
    auto bad = identity(0, 1, 1, 1);
    if (item == 0) bad.angle = 2;
    if (item == 1) bad.sourceEpoch = 0;
    if (item == 2) bad.operation = groupsurfacewire::MaximumSequence + 1;
    if (item == 3) bad.globalTicks = groupsurfacewire::MaximumTicks + 1;
    if (item == 4) { bad.content = groupsurfacewire::Content::Blank; bad.sourcePTS = 1; }
    if (item == 5) bad.sourceIndex = groupsurfacewire::MaximumSources;
    if (item == 6) bad.sourceEndPTS = bad.sourcePTS;
    if (item == 7) bad.globalEnd = bad.globalTicks;
    if (item == 8) bad.globalEnd += 100;
    fails([&]{sender.sendPair({lease, lease}, {bad, identity(1, 1, 1, 1)});}, "invalid group frame identity");
  }
  assert(sender.nextID() == 1 && sender.pending() == 0 && !receiver.poll());
  fails([&]{sender.sendPair({lease, lease}, {identity(0, 1, 1, 1), identity(1, 1, 1, 2)});}, "invalid group pair identity");
  auto blank = identity(1, 3, 4, 100); blank.content = groupsurfacewire::Content::Blank;
  blank.sourceIndex = groupsurfacewire::MaximumSources; blank.sourcePTS = 0; blank.sourceEndPTS = 0;
  assert(sender.sendPair({lease, lease}, {identity(0, 1, 4, 100), blank}));
  fails([&]{sender.sendPair({lease, lease}, {identity(0, 1, 4, 100), blank});}, "invalid group pair identity");
  auto first = receiver.poll(); auto frame = receiver.poll();
  assert(first && frame && frame->identity.content == groupsurfacewire::Content::Blank);
  fails([&]{receiver.close();}, "group surface references still owned");
  receiver.release(1); receiver.release(2); sender.poll(); receiver.close();
}
void v1PacketCannotEnterGroup() {
  auto name = service(); GroupSurfaceReceiver receiver; receiver.open(name.c_str()); receiver.setPeer(getpid());
  mach_port_t port = 0; assert(bootstrap_look_up(bootstrap_port, name.c_str(), &port) == KERN_SUCCESS);
  surfacewire::Ack old{}; old.header.msgh_bits = MACH_MSGH_BITS(MACH_MSG_TYPE_COPY_SEND, 0);
  old.header.msgh_size = sizeof(old); old.header.msgh_remote_port = port; old.header.msgh_id = surfacewire::Frame;
  assert(mach_msg(&old.header, MACH_SEND_MSG | MACH_SEND_TIMEOUT, sizeof(old), 0, 0, 0, 0) == KERN_SUCCESS);
  mach_port_deallocate(mach_task_self(), port);
  fails([&]{receiver.poll();}, "unauthorized or invalid group surface packet");
  assert(receiver.count() == 0); receiver.close();
}
void foreignPeerAndUnconfirmedTeardown() {
  appleplayback::FrameBudget budget(64ULL * 1024 * 1024); auto lease = image(budget); auto bytes = budget.usedBytes();
  auto name = service(); GroupSurfaceReceiver receiver; receiver.open(name.c_str()); receiver.setPeer(getpid() + 1);
  auto sender = std::make_unique<GroupSurfaceSender>(budget); sender->open(name.c_str(), getpid());
  assert(sender->sendPair({lease, lease}, {identity(0, 1, 1, 0), identity(1, 1, 1, 0)}));
  fails([&]{receiver.poll();}, "unauthorized or invalid group surface packet");
  assert(receiver.count() == 0 && sender->pending() == 2);
  fails([&]{receiver.poll();}, "unauthorized or invalid group surface packet");
  sender.reset(); assert(budget.quarantinedBytes() == bytes);
  receiver.close();
}
void stopHistoryIsBoundedAndIndependentOfImageOwnership() {
  appleplayback::FrameBudget budget(64ULL * 1024 * 1024); auto lease = image(budget);
  auto name = service(); GroupSurfaceReceiver receiver; receiver.open(name.c_str()); receiver.setPeer(getpid());
  GroupSurfaceSender sender(budget); sender.open(name.c_str(), getpid());
  for (uint64_t pair = 1; pair <= 65; ++pair) {
    std::array<groupsurfacewire::Identity, 2> values{identity(0, 1, 1, pair), identity(1, 1, 1, pair)};
    for (auto& value : values) value.pair = pair;
    assert(sender.sendPair({lease, lease}, values));
    for (size_t angle = 0; angle < 2; ++angle) { auto frame = receiver.poll(); assert(frame); receiver.release(frame->identity.id); }
    sender.poll(); assert(sender.pending() == 0);
  }
  fails([&]{sender.stopAnchor({1, 1, 1, 1, 1, 2}, 2, 1);}, "group stop pair unavailable");
  assert(sender.stopAnchor({1, 1, 65, 65, 129, 130}, 2, 1) == 65);
  assert(budget.quarantinedBytes() == 0); receiver.close();
}
}

int main() { @autoreleasepool {
  pairReplacementAndGlobalCredit(); invalidIdentityHasNoSideEffects(); v1PacketCannotEnterGroup();
  foreignPeerAndUnconfirmedTeardown();
  stopHistoryIsBoundedAndIndependentOfImageOwnership();
  puts("GroupSurface: identity, pair credits, cancellation, v1 isolation and quarantine passed");
} }
