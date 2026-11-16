#pragma once
#include "SurfaceGroupWire.hpp"
#include "SurfaceSender.hpp"
#include <array>
#include <optional>

// One sender per group, so delivery IDs and six credits are group-wide.
// Actor confined; image leases may be released by another consumer/thread.
class GroupSurfaceSender {
  using Pixel = std::remove_pointer_t<CVPixelBufferRef>;
  using Lease = appleplayback::RetainedImage<Pixel>;
  struct Held { Lease lease; PixelReference image; groupsurfacewire::Identity identity; };
  appleplayback::FrameBudget budget_;
  mach_port_t server_ = 0, receiver_ = 0;
  pid_t peer_ = 0;
  uint64_t serial_ = 0;
  uint64_t lastPair_ = 0, lastOperation_ = 0, lastSeek_ = 0;
  bool demanded_ = false, openAttempted_ = false, opened_ = false;
  std::map<uint64_t, Held> held_;
  std::array<std::optional<groupsurfacewire::Identity>, groupsurfacewire::Angles> drawn_;
  struct Published { std::array<groupsurfacewire::Identity, 2> images; bool complete = false; };
  std::map<uint64_t, Published> published_;
public:
  explicit GroupSurfaceSender(appleplayback::FrameBudget budget) : budget_(std::move(budget)) {}
  GroupSurfaceSender(const GroupSurfaceSender&) = delete;
  GroupSurfaceSender& operator=(const GroupSurfaceSender&) = delete;
  void open(const char* name, pid_t peer) {
    if (openAttempted_ || peer <= 0 || !name || strlen(name) < 36 || strlen(name) > 126 ||
        strncmp(name, "local.sportaglytics.surface.", 27)) throw std::runtime_error("invalid group surface peer");
    openAttempted_ = true;
    peer_ = peer;
    if (bootstrap_look_up(bootstrap_port, name, &server_) != KERN_SUCCESS ||
        mach_port_allocate(mach_task_self(), MACH_PORT_RIGHT_RECEIVE, &receiver_) != KERN_SUCCESS ||
        groupsurfacewire::configureReplyQueue(receiver_) != KERN_SUCCESS)
      throw std::runtime_error("group surface connection failed");
    opened_ = true;
  }
private:
  IOSurfaceRef qualify(const Lease& lease, groupsurfacewire::Identity value) const {
    if (!opened_) throw std::runtime_error("group surface not open");
    if (!lease.image() || !budget_.owns(lease)) throw std::runtime_error("invalid group image lease");
    if (budget_.quarantinedBytes()) throw SurfaceBudgetUnavailable{};
    value.id = 1; // caller IDs never authorize delivery; sender assigns them
    if (!groupsurfacewire::valid(value)) throw std::runtime_error("invalid group frame identity");
    auto image = lease.image(); auto surface = CVPixelBufferGetIOSurface(image);
    // First group transport retains the already-qualified v1 NV12 layout.
    // General-source admission is a separate Main/profile qualification task.
    if (!surface || CVPixelBufferGetWidth(image) != 1920 || CVPixelBufferGetHeight(image) != 1080 ||
        CVPixelBufferGetPixelFormatType(image) != kCVPixelFormatType_420YpCbCr8BiPlanarVideoRange ||
        CVPixelBufferGetPlaneCount(image) != 2 || IOSurfaceGetWidth(surface) != 1920 ||
        IOSurfaceGetHeight(surface) != 1080 || IOSurfaceGetPixelFormat(surface) != '420v' ||
        IOSurfaceGetPlaneCount(surface) != 2) throw std::runtime_error("unexpected group surface layout");
    return surface;
  }
  bool sendOne(const Lease& lease, groupsurfacewire::Identity value) {
    value.id = serial_ + 1;
    auto surface = qualify(lease, value); auto image = lease.image();
    if (held_.size() >= groupsurfacewire::Limit) return false;
    mach_port_t port = IOSurfaceCreateMachPort(surface);
    if (!port) throw std::runtime_error("group surface port failed");
    groupsurfacewire::FrameMessage m{};
    m.header.msgh_bits = MACH_MSGH_BITS_COMPLEX | MACH_MSGH_BITS(MACH_MSG_TYPE_COPY_SEND, 0);
    m.header.msgh_size = sizeof(m); m.header.msgh_remote_port = server_; m.header.msgh_id = groupsurfacewire::Frame;
    m.body.msgh_descriptor_count = 2;
    m.surface.name = port; m.surface.disposition = MACH_MSG_TYPE_COPY_SEND; m.surface.type = MACH_MSG_PORT_DESCRIPTOR;
    m.reply.name = receiver_; m.reply.disposition = MACH_MSG_TYPE_MAKE_SEND; m.reply.type = MACH_MSG_PORT_DESCRIPTOR;
    m.identity = value;
    try { held_.emplace(value.id, Held{lease, PixelReference(image), value}); }
    catch (...) { mach_port_deallocate(mach_task_self(), port); throw; }
    ++serial_;
    auto status = mach_msg(&m.header, MACH_SEND_MSG | MACH_SEND_TIMEOUT, sizeof(m), 0, 0, 0, 0);
    mach_port_deallocate(mach_task_self(), port);
    if (status != KERN_SUCCESS) { held_.erase(value.id); throw std::runtime_error("group surface send failed"); }
    return true;
  }
public:
  // Reserve both credits before publishing either angle. A send error after
  // the first delivery is still a partial outcome: retain/drain it, never retry
  // the pair. Producer provenance is separate from these display identities.
  bool sendPair(const std::array<Lease, 2>& images,
                const std::array<groupsurfacewire::Identity, 2>& values) {
    for (size_t i = 0; i < 2; ++i) qualify(images[i], values[i]);
    if (values[0].angle != 0 || values[1].angle != 1 ||
        values[0].operation != values[1].operation || values[0].seek != values[1].seek ||
        values[0].pair != values[1].pair || values[0].globalTicks != values[1].globalTicks ||
        values[0].pair <= lastPair_ || values[0].operation < lastOperation_ || values[0].seek < lastSeek_)
      throw std::runtime_error("invalid group pair identity");
    if (serial_ > groupsurfacewire::MaximumSequence - 2)
      throw std::runtime_error("group delivery sequence exhausted");
    if (held_.size() > groupsurfacewire::Limit - 2) return false;
    auto actual = values;
    actual[0].id = serial_ + 1; actual[1].id = serial_ + 2;
    // Reserve metadata before any physical send. A partial outcome remains
    // incomplete and can never authorize a stop at an unissued second image.
    auto history = published_.emplace(values[0].pair, Published{actual, false});
    if (!history.second) throw std::runtime_error("group pair already published");
    lastPair_ = values[0].pair; lastOperation_ = values[0].operation; lastSeek_ = values[0].seek;
    if (!sendOne(images[0], values[0]) || !sendOne(images[1], values[1]))
      throw std::runtime_error("group pair credit lost");
    history.first->second.complete = true;
    while (published_.size() > 64) published_.erase(published_.begin());
    return true;
  }
  uint64_t stopAnchor(const groupsurfacewire::StopProof& proof,
                      uint64_t nextOperation, uint64_t seek) const {
    if (!proof.operation || !proof.seek || !proof.pair || !proof.firstID || !proof.secondID ||
        nextOperation > groupsurfacewire::MaximumSequence || nextOperation <= proof.operation ||
        nextOperation <= lastOperation_ || seek != proof.seek || seek < lastSeek_)
      throw std::runtime_error("invalid group stop owner");
    auto found = published_.find(proof.pair);
    if (found == published_.end() || !found->second.complete)
      throw std::runtime_error("group stop pair unavailable");
    const auto& a = found->second.images[0]; const auto& b = found->second.images[1];
    if (a.operation != proof.operation || a.seek != proof.seek || a.globalTicks != proof.globalTicks ||
        a.id != proof.firstID || b.id != proof.secondID)
      throw std::runtime_error("group stop pair mismatch");
    for (const auto& drawn : drawn_)
      if (drawn && drawn->pair > proof.pair) throw std::runtime_error("group stop pair stale");
    return a.globalTicks;
  }
  void poll() {
    if (!receiver_) return;
    for (size_t i = 0; i < groupsurfacewire::Limit * 3 + 1; ++i) {
      surfacewire::Receive<surfacewire::Ack> b{};
      auto status = mach_msg(&b.message.header, surfacewire::receiveOptions(), 0, sizeof(b), receiver_, 0, 0);
      if (status == MACH_RCV_TIMED_OUT) return;
      if (status != KERN_SUCCESS) throw std::runtime_error("group surface ack receive failed");
      auto& a = b.message;
      bool trusted = surfacewire::fromPeer(&a.header, sizeof(a), peer_) && !(a.header.msgh_bits & MACH_MSGH_BITS_COMPLEX);
      if (trusted && a.header.msgh_id == groupsurfacewire::Request && !a.id) { demanded_ = true; continue; }
      if (!trusted || !held_.count(a.id) || (a.header.msgh_id != groupsurfacewire::Drawn && a.header.msgh_id != groupsurfacewire::Released)) {
        mach_msg_destroy(&a.header); throw std::runtime_error("invalid group surface ack");
      }
      auto& h = held_.at(a.id);
      if (a.header.msgh_id == groupsurfacewire::Drawn) {
        auto& slot = drawn_[h.identity.angle];
        if (!slot || h.identity.id > slot->id) slot = h.identity;
      }
      else held_.erase(a.id);
    }
  }
  const std::optional<groupsurfacewire::Identity>& drawn(size_t angle) const {
    if (angle >= drawn_.size()) throw std::out_of_range("group angle");
    return drawn_[angle];
  }
  bool demanded() const { return demanded_; }
  void consumedDemand() { demanded_ = false; }
  size_t pending() const { return held_.size(); }
  uint64_t nextID() const { return serial_ + 1; }
  ~GroupSurfaceSender() {
    for (const auto& item : held_) item.second.lease.quarantine();
    held_.clear();
    if (receiver_) mach_port_mod_refs(mach_task_self(), receiver_, MACH_PORT_RIGHT_RECEIVE, -1);
    if (server_) mach_port_deallocate(mach_task_self(), server_);
  }
};
