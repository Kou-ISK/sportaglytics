#include "SurfaceSender.hpp"
#include "../apple-player/ReverseFrameCache.hpp"
#import <Foundation/Foundation.h>
#include <cassert>
#include <cstdio>
#include <memory>
#include <string>
#include <unistd.h>

namespace {
struct PixelPool {
  CVPixelBufferPoolRef pool = nullptr;
  PixelPool(size_t width = 1920, size_t height = 1080) {
    NSDictionary *attributes = @{
      (id)kCVPixelBufferWidthKey: @(width), (id)kCVPixelBufferHeightKey: @(height),
      (id)kCVPixelBufferPixelFormatTypeKey: @(kCVPixelFormatType_420YpCbCr8BiPlanarVideoRange),
      (id)kCVPixelBufferIOSurfacePropertiesKey: @{}
    };
    assert(CVPixelBufferPoolCreate(nullptr, nullptr, (__bridge CFDictionaryRef)attributes, &pool) == kCVReturnSuccess);
  }
  CVReturn allocate(CVPixelBufferRef *image, size_t limit) {
    NSDictionary *options = @{(id)kCVPixelBufferPoolAllocationThresholdKey: @(limit)};
    return CVPixelBufferPoolCreatePixelBufferWithAuxAttributes(nullptr, pool, (__bridge CFDictionaryRef)options, image);
  }
  CVPixelBufferRef take(size_t limit = 1) {
    CVPixelBufferRef image = nullptr;
    auto status = allocate(&image, limit);
    if (status != kCVReturnSuccess) std::fprintf(stderr, "pixel allocation failed: %d (limit %zu)\n", status, limit);
    assert(status == kCVReturnSuccess);
    assert(image && CVPixelBufferGetIOSurface(image));
    return image;
  }
  void blocked(size_t limit = 1) {
    CVPixelBufferRef image = nullptr;
    assert(allocate(&image, limit) == kCVReturnWouldExceedAllocationThreshold);
    assert(!image);
  }
  ~PixelPool() { CVPixelBufferPoolRelease(pool); }
};
struct Endpoint {
  mach_port_t port = MACH_PORT_NULL;
  std::string name;
  Endpoint() {
    static unsigned serial = 0;
    name = "local.sportaglytics.surface.test." + std::to_string(getpid()) + "." + std::to_string(++serial);
    assert(mach_port_allocate(mach_task_self(), MACH_PORT_RIGHT_RECEIVE, &port) == KERN_SUCCESS);
    assert(mach_port_insert_right(mach_task_self(), port, port, MACH_MSG_TYPE_MAKE_SEND) == KERN_SUCCESS);
    assert(bootstrap_register(bootstrap_port, name.data(), port) == KERN_SUCCESS);
  }
  void close() {
    if (!port) return;
    assert(mach_port_deallocate(mach_task_self(), port) == KERN_SUCCESS);
    assert(mach_port_mod_refs(mach_task_self(), port, MACH_PORT_RIGHT_RECEIVE, -1) == KERN_SUCCESS);
    port = MACH_PORT_NULL;
  }
  ~Endpoint() { close(); }
};
struct Frame {
  surfacewire::Receive<surfacewire::FrameMessage> packet{};
  explicit Frame(mach_port_t port) {
    assert(mach_msg(&packet.message.header, surfacewire::receiveOptions(), 0,
      sizeof(packet), port, 0, MACH_PORT_NULL) == KERN_SUCCESS);
    assert(surfacewire::fromPeer(&packet.message.header, sizeof(packet.message), getpid()));
  }
  void ack(int kind) {
    assert(surfacewire::reply(packet.message.reply.name, packet.message.id, kind) == KERN_SUCCESS);
  }
  void releaseSurface() {
    assert(mach_port_deallocate(mach_task_self(), packet.message.surface.name) == KERN_SUCCESS);
    packet.message.surface.name = MACH_PORT_NULL;
  }
  ~Frame() { mach_msg_destroy(&packet.message.header); }
};
template<class F> void fails(F operation, const char *reason) {
  try { operation(); assert(false); }
  catch (const std::runtime_error& error) { assert(std::string(error.what()) == reason); }
}

void copyOwnershipAndExceptions() {
  PixelPool pool;
  @try {
    auto owner = PixelReference::adopt(pool.take());
    pool.blocked();
    @throw [NSException exceptionWithName:@"PlaybackFailure" reason:@"timestamp" userInfo:nil];
  } @catch (NSException *error) {
    assert([error.reason isEqual:@"timestamp"]);
  }
  CVPixelBufferRelease(pool.take()); // Objective-C unwinding released the copy.
  {
    auto first = PixelReference::adopt(pool.take(2));
    auto second = PixelReference::adopt(pool.take(2));
    pool.blocked(2);
    second = std::move(first); // release prior image and transfer single ownership
    CVPixelBufferRelease(pool.take(2));
    auto third = std::move(second);
    fails([&] { throw std::runtime_error("send"); }, "send");
  }
  CVPixelBufferRelease(pool.take(2));
}

void drawThenRelease() {
  PixelPool pool;
  Endpoint endpoint;
  SurfaceSender sender;
  sender.open(endpoint.name.c_str(), getpid());
  auto image = pool.take();
  const auto surfaceID = IOSurfaceGetID(CVPixelBufferGetIOSurface(image));
  assert(sender.send(image, 7, 9, 864003140));
  CVPixelBufferRelease(image); // AVPlayer's copy reference is no longer held.
  Frame frame(endpoint.port);
  assert(frame.packet.message.generation == 7 && frame.packet.message.seek == 9);
  assert(frame.packet.message.pts == 864003140);
  auto surface = IOSurfaceLookupFromMachPort(frame.packet.message.surface.name);
  assert(surface && IOSurfaceGetID(surface) == surfaceID); // original storage, no copy
  CFRelease(surface);
  frame.releaseSurface(); // Only the sender's CVPixelBuffer reference now remains.
  pool.blocked();
  frame.ack(surfacewire::Drawn);
  sender.poll();
  assert(sender.drawn(7, 864003140) && sender.pending() == 1);
  pool.blocked(); // Drawn is not GPU release.
  frame.ack(surfacewire::Released);
  sender.poll();
  assert(sender.pending() == 0);
  CVPixelBufferRelease(pool.take());
  frame.ack(surfacewire::Released);
  fails([&] { sender.poll(); }, "invalid surface ack"); // no double release
}

void cacheLeaseSurvivesUntilRelease() {
  using Image = std::remove_pointer_t<CVPixelBufferRef>;
  PixelPool pool;
  Endpoint endpoint;
  auto image = pool.take();
  const auto bytes = CVPixelBufferGetDataSize(image);
  appleplayback::FrameBudget budget(bytes);
  SurfaceSender sender(budget);
  sender.open(endpoint.name.c_str(), getpid());
  appleplayback::ReverseFrameCache<Image> cache;
  assert(cache.beginRequest(1, 10));
  auto frame = budget.retain(appleplayback::OwnedImage<Image>(image,
      [](Image *value) { CVPixelBufferRelease(value); }), 1, 10, 0, .02, bytes);
  assert(frame);
  assert(cache.publish({*frame}));
  // A later consumer operation borrows an immutable completed source image.
  assert(cache.beginRequest(2, 10));
  auto selected = cache.select(.01, 2);
  assert(selected && sender.sendLeased(selected->imageLease(), 7, 9, 0));
  frame.reset(); selected.reset(); cache.clear();
  assert(budget.usedBytes() == bytes); // sole remaining owner is the sender
  Frame received(endpoint.port);
  received.releaseSurface();
  pool.blocked();
  received.ack(surfacewire::Drawn); sender.poll();
  assert(sender.drawn(7, 0) && budget.usedBytes() == bytes);
  pool.blocked(); // neither cache eviction nor Drawn returns the charge
  received.ack(surfacewire::Released); sender.poll();
  assert(sender.pending() == 0 && budget.usedBytes() == 0);
  CVPixelBufferRelease(pool.take()); // original storage may now be reused
  received.ack(surfacewire::Released);
  fails([&] { sender.poll(); }, "invalid surface ack");
  assert(budget.usedBytes() == 0); // duplicate ACK cannot decrement twice
}

void leasedSendFailureAndMovedFrame() {
  using Image = std::remove_pointer_t<CVPixelBufferRef>;
  PixelPool pool;
  auto image = pool.take();
  const auto bytes = CVPixelBufferGetDataSize(image);
  appleplayback::FrameBudget budget(bytes);
  auto frame = budget.retain(appleplayback::OwnedImage<Image>(image,
      [](Image *value) { CVPixelBufferRelease(value); }), 1, 10, 0, .02, bytes);
  assert(frame);
  {
  auto moved = std::move(*frame);
  SurfaceSender sender(budget);
  assert(!frame->image());
  fails([&] { sender.sendLeased(frame->imageLease(), 1, 1, 0); }, "invalid frame lease");
  assert(sender.pending() == 0 && sender.nextID() == 1 && budget.usedBytes() == bytes);
  appleplayback::FrameBudget foreign(bytes);
  auto other = foreign.retainImage(appleplayback::OwnedImage<Image>(CVPixelBufferRetain(image),
      [](Image *value) { CVPixelBufferRelease(value); }), bytes);
  assert(other);
  fails([&] { sender.sendLeased(*other, 1, 1, 0); }, "foreign frame budget");
  assert(sender.pending() == 0 && sender.nextID() == 1);
  other.reset(); assert(foreign.usedBytes() == 0);
  Endpoint endpoint;
  sender.open(endpoint.name.c_str(), getpid());
  endpoint.close();
  fails([&] { sender.sendLeased(moved.imageLease(), 1, 1, 0); }, "surface send failed");
  assert(sender.pending() == 0 && budget.usedBytes() == bytes); // caller still owns it
  pool.blocked();
  }
  assert(budget.usedBytes() == 0);
  CVPixelBufferRelease(pool.take());
}

void rawTransferBudgetRefusal() {
  PixelPool pool;
  appleplayback::FrameBudget budget(1);
  SurfaceSender sender(budget);
  auto image = pool.take();
  bool typedFailure = false;
  try { sender.send(image, 1, 1, 0); }
  catch (const SurfaceBudgetUnavailable& error) {
    typedFailure = true;
    assert(std::string(error.what()) == "surface transfer budget unavailable");
  }
  assert(typedFailure); // the Host routes this type to media failure/restoration
  assert(sender.pending() == 0 && sender.nextID() == 1 && budget.usedBytes() == 0);
  pool.blocked(); // the caller still owns its original AVPlayer-style copy
  CVPixelBufferRelease(image);
  CVPixelBufferRelease(pool.take());
}

void oneImageSharedByTwoSenders() {
  using Image = std::remove_pointer_t<CVPixelBufferRef>;
  PixelPool pool;
  auto image = pool.take();
  const auto bytes = CVPixelBufferGetDataSize(image);
  appleplayback::FrameBudget budget(bytes);
  Endpoint left, right;
  SurfaceSender first(budget), second(budget);
  first.open(left.name.c_str(), getpid()); second.open(right.name.c_str(), getpid());
  auto lease = budget.retainImage(appleplayback::OwnedImage<Image>(image,
      [](Image *value) { CVPixelBufferRelease(value); }), bytes);
  assert(lease && first.sendLeased(*lease, 1, 1, 0));
  assert(second.sendLeased(*lease, 2, 2, 0));
  lease.reset();
  assert(budget.usedBytes() == bytes); // two consumers, one storage charge
  Frame a(left.port), b(right.port);
  a.releaseSurface(); b.releaseSurface();
  a.ack(surfacewire::Released); first.poll(); // cancelled before drawing
  assert(budget.usedBytes() == bytes); pool.blocked();
  b.ack(surfacewire::Drawn); second.poll();
  assert(budget.usedBytes() == bytes); pool.blocked();
  b.ack(surfacewire::Released); second.poll();
  assert(budget.usedBytes() == 0);
  CVPixelBufferRelease(pool.take());
}

void uncertainTeardownQuarantinesSharedStorage() {
  using Image = std::remove_pointer_t<CVPixelBufferRef>;
  PixelPool pool;
  auto image = pool.take();
  const auto bytes = CVPixelBufferGetDataSize(image);
  appleplayback::FrameBudget budget(bytes * 2);
  Endpoint left, right;
  auto first = std::make_unique<SurfaceSender>(budget);
  SurfaceSender second(budget);
  first->open(left.name.c_str(), getpid()); second.open(right.name.c_str(), getpid());
  auto lease = budget.retainImage(appleplayback::OwnedImage<Image>(image,
      [](Image *value) { CVPixelBufferRelease(value); }), bytes);
  assert(lease && first->sendLeased(*lease, 1, 1, 0));
  assert(second.sendLeased(*lease, 2, 2, 0));
  Frame a(left.port), b(right.port);
  a.releaseSurface(); b.releaseSurface();
  a.ack(surfacewire::Drawn); first->poll();
  first.reset(); // no Released: reply channel is gone, not proof of drainage
  lease->quarantine(); // repeated retirement must not count the storage twice
  assert(budget.usedBytes() == bytes && budget.quarantinedBytes() == bytes);
  fails([&] { second.sendLeased(*lease, 3, 3, 0); }, "surface transfer budget unavailable");
  assert(second.pending() == 1 && second.nextID() == 2);
  lease.reset();
  b.ack(surfacewire::Released); second.poll();
  assert(second.pending() == 0 && budget.usedBytes() == bytes);
  assert(budget.quarantinedBytes() == bytes); // other consumer cannot resolve a
  auto next = pool.take();
  assert(!budget.retainImage(appleplayback::OwnedImage<Image>(next,
      [](Image *value) { CVPixelBufferRelease(value); }), bytes));
  assert(budget.usedBytes() == bytes); // even physically reusable is not confirmed
}

void capAndTeardown() {
  PixelPool pool;
  Endpoint endpoint;
  std::unique_ptr<Frame> frames[surfacewire::Limit];
  {
    SurfaceSender sender;
    sender.open(endpoint.name.c_str(), getpid());
    for (size_t i = 0; i < surfacewire::Limit; ++i) {
      auto image = pool.take(surfacewire::Limit);
      assert(sender.send(image, i + 1, i + 1, i * 2002));
      CVPixelBufferRelease(image);
      frames[i] = std::make_unique<Frame>(endpoint.port);
    }
    assert(sender.pending() == surfacewire::Limit);
    pool.blocked(surfacewire::Limit);
    // No extra reference or serial consumed when all three credits are held.
    auto id = sender.nextID();
    assert(!sender.send(nullptr, 4, 4, 6006) && sender.nextID() == id);
    frames[0]->releaseSurface();
    frames[0]->ack(surfacewire::Released); // cancellation before Drawn is valid
    sender.poll();
    assert(sender.pending() == surfacewire::Limit - 1);
    auto image = pool.take(surfacewire::Limit);
    assert(sender.send(image, 4, 4, 6006));
    CVPixelBufferRelease(image);
    frames[0] = std::make_unique<Frame>(endpoint.port);
    pool.blocked(surfacewire::Limit);
  }
  for (auto& frame : frames) frame.reset();
  auto image = pool.take(surfacewire::Limit); // teardown relinquishes held pixels
  CVPixelBufferRelease(image);
}

void failuresRetainOnlyWhenOwned() {
  PixelPool pool;
  Endpoint endpoint;
  {
    SurfaceSender sender;
    sender.open(endpoint.name.c_str(), getpid() + 1);
    auto image = pool.take();
    assert(sender.send(image, 1, 1, 0));
    CVPixelBufferRelease(image);
    Frame frame(endpoint.port);
    frame.ack(surfacewire::Released);
    fails([&] { sender.poll(); }, "invalid surface ack");
    assert(sender.pending() == 1);
    pool.blocked(); // unauthorized ACK must not relinquish producer ownership
  }
  {
    SurfaceSender sender;
    sender.open(endpoint.name.c_str(), getpid());
    endpoint.close();
    auto image = pool.take();
    fails([&] { sender.send(image, 1, 1, 0); }, "surface send failed");
    assert(sender.pending() == 0);
    CVPixelBufferRelease(image);
    CVPixelBufferRelease(pool.take());
  }
  PixelPool wrongLayout(16, 16);
  SurfaceSender sender;
  auto image = wrongLayout.take();
  fails([&] { sender.send(image, 1, 1, 0); }, "unexpected surface layout");
  fails([&] { sender.send(nullptr, 1, 1, 0); }, "missing surface");
  CVPixelBufferRelease(image);
  CVPixelBufferRelease(wrongLayout.take());
  assert(sender.pending() == 0 && sender.nextID() == 1);
}
}

int main() {
  @autoreleasepool {
    std::puts("copy ownership and Objective-C exceptions"); std::fflush(stdout);
    copyOwnershipAndExceptions();
    std::puts("draw then GPU release"); std::fflush(stdout);
    drawThenRelease();
    std::puts("shared cache budget through Drawn and Released"); std::fflush(stdout);
    cacheLeaseSurvivesUntilRelease();
    std::puts("leased send failure and invalid moved frame"); std::fflush(stdout);
    leasedSendFailureAndMovedFrame();
    std::puts("raw transfer finite budget refusal"); std::fflush(stdout);
    rawTransferBudgetRefusal();
    std::puts("two consumers share one storage charge"); std::fflush(stdout);
    oneImageSharedByTwoSenders();
    std::puts("unconfirmed teardown quarantines shared storage"); std::fflush(stdout);
    uncertainTeardownQuarantinesSharedStorage();
    std::puts("credit limit and teardown"); std::fflush(stdout);
    capAndTeardown();
    std::puts("invalid ACK, send failure and layout rejection"); std::fflush(stdout);
    failuresRetainOnlyWhenOwned();
    std::puts("SurfaceSender: original pixel retention, ACK, cap and failure paths passed");
  }
}
