#pragma once
#include "GroupSurfaceLayout.hpp"
#include "SurfaceGroupWire.hpp"
#include <IOSurface/IOSurface.h>
#include <servers/bootstrap.h>
#include <map>
#include <optional>
#include <stdexcept>

// Main-only native receiver resource owner. No N-API/Renderer policy here.
class GroupSurfaceReceiver {
public:
  struct Frame { groupsurfacewire::Identity identity; IOSurfaceRef surface; };
private:
  struct Held { Frame frame; mach_port_t reply; bool drawn = false, drawUnknown = false, releaseUnknown = false; };
  mach_port_t receiver_ = 0, demand_ = 0;
  pid_t peer_ = 0;
  uint64_t lastID_ = 0;
  std::map<uint64_t, Held> held_;
  bool attempted_ = false, closeAttempted_ = false, closeFailed_ = false;
public:
  GroupSurfaceReceiver() = default;
  GroupSurfaceReceiver(const GroupSurfaceReceiver&) = delete;
  GroupSurfaceReceiver& operator=(const GroupSurfaceReceiver&) = delete;
  void open(const char* name) {
    if (attempted_ || closeAttempted_) throw std::runtime_error("group receiver open already attempted");
    attempted_ = true;
    if (!name || strlen(name) < 36 || strlen(name) > 126 ||
        strncmp(name, "local.sportaglytics.surface.", 27)) throw std::runtime_error("invalid group service");
    auto status = mach_port_allocate(mach_task_self(), MACH_PORT_RIGHT_RECEIVE, &receiver_);
    if (status == KERN_SUCCESS) status = mach_port_insert_right(mach_task_self(), receiver_, receiver_, MACH_MSG_TYPE_MAKE_SEND);
    if (status == KERN_SUCCESS) {
      mach_port_limits_t limits{groupsurfacewire::Limit};
      status = mach_port_set_attributes(mach_task_self(), receiver_, MACH_PORT_LIMITS_INFO,
        reinterpret_cast<mach_port_info_t>(&limits), MACH_PORT_LIMITS_INFO_COUNT);
    }
    if (status == KERN_SUCCESS) status = bootstrap_register(bootstrap_port, const_cast<char*>(name), receiver_);
    if (status != KERN_SUCCESS) throw std::runtime_error("group receiver registration failed");
  }
  void setPeer(pid_t peer) {
    if (peer <= 0 || peer_) throw std::runtime_error("invalid group receiver peer");
    peer_ = peer;
  }
  std::optional<Frame> poll() {
    if (!receiver_ || !peer_) return std::nullopt;
    surfacewire::Receive<groupsurfacewire::FrameMessage> b{};
    auto status = mach_msg(&b.message.header, surfacewire::receiveOptions(), 0, sizeof(b), receiver_, 0, 0);
    if (status == MACH_RCV_TIMED_OUT) return std::nullopt;
    if (status != KERN_SUCCESS) throw std::runtime_error("group surface receive failed");
    auto& m = b.message;
    if (!surfacewire::fromPeer(&m.header, sizeof(m), peer_) || m.header.msgh_id != groupsurfacewire::Frame ||
        !(m.header.msgh_bits & MACH_MSGH_BITS_COMPLEX) || m.body.msgh_descriptor_count != 2 ||
        m.surface.type != MACH_MSG_PORT_DESCRIPTOR || m.reply.type != MACH_MSG_PORT_DESCRIPTOR ||
        m.surface.disposition != MACH_MSG_TYPE_PORT_SEND || m.reply.disposition != MACH_MSG_TYPE_PORT_SEND ||
        !groupsurfacewire::valid(m.identity) || m.identity.id <= lastID_ || held_.size() >= groupsurfacewire::Limit) {
      mach_msg_destroy(&m.header); throw std::runtime_error("unauthorized or invalid group surface packet");
    }
    auto surface = IOSurfaceLookupFromMachPort(m.surface.name);
    mach_port_deallocate(mach_task_self(), m.surface.name); m.surface.name = 0;
    if (!groupsurfacewire::supportedImageLayout(surface)) {
      if (surface) CFRelease(surface); mach_msg_destroy(&m.header);
      throw std::runtime_error("unexpected group surface layout");
    }
    if (demand_ && demand_ != m.reply.name) {
      CFRelease(surface); mach_msg_destroy(&m.header);
      throw std::runtime_error("group reply channel changed");
    }
    if (!demand_) {
      if (mach_port_mod_refs(mach_task_self(), m.reply.name, MACH_PORT_RIGHT_SEND, 1) != KERN_SUCCESS) {
        CFRelease(surface); mach_msg_destroy(&m.header); throw std::runtime_error("retain group demand failed");
      }
      demand_ = m.reply.name;
    }
    try { held_.emplace(m.identity.id, Held{Frame{m.identity, surface}, m.reply.name}); }
    catch (...) { CFRelease(surface); mach_msg_destroy(&m.header); throw; }
    lastID_ = m.identity.id; m.reply.name = 0;
    return Frame{m.identity, surface}; // borrowed until release; never a Renderer pointer
  }
  void drawn(uint64_t id) {
    auto found = held_.find(id);
    if (found == held_.end() || found->second.drawn) throw std::runtime_error("unknown or duplicate group draw");
    if (found->second.drawUnknown) throw std::runtime_error("previous group draw uncertain");
    if (surfacewire::reply(found->second.reply, id, groupsurfacewire::Drawn) != KERN_SUCCESS) {
      found->second.drawUnknown = true;
      throw std::runtime_error("group draw reply failed");
    }
    found->second.drawn = true;
  }
  void release(uint64_t id) {
    auto found = held_.find(id);
    if (found == held_.end()) throw std::runtime_error("unknown group release");
    if (found->second.releaseUnknown) throw std::runtime_error("previous group release uncertain; ownership retained");
    if (surfacewire::reply(found->second.reply, id, groupsurfacewire::Released) != KERN_SUCCESS) {
      found->second.releaseUnknown = true;
      throw std::runtime_error("group release uncertain; ownership retained");
    }
    CFRelease(found->second.frame.surface);
    mach_port_deallocate(mach_task_self(), found->second.reply); held_.erase(found);
  }
  void request() {
    if (demand_ && surfacewire::reply(demand_, 0, groupsurfacewire::Request) != KERN_SUCCESS)
      throw std::runtime_error("group demand failed");
  }
  size_t count() const { return held_.size(); }
  void close() {
    if (!held_.empty()) throw std::runtime_error("group surface references still owned");
    // Caller must already have confirmed producer shutdown. Check the unread
    // queue as well; an empty imported-frame map alone is not drainage.
    if (!closeAttempted_ && receiver_) {
      mach_port_status_t status{}; mach_msg_type_number_t count = MACH_PORT_RECEIVE_STATUS_COUNT;
      if (mach_port_get_attributes(mach_task_self(), receiver_, MACH_PORT_RECEIVE_STATUS,
          reinterpret_cast<mach_port_info_t>(&status), &count) != KERN_SUCCESS) {
        closeAttempted_ = closeFailed_ = true;
        throw std::runtime_error("group receiver queue state unavailable");
      }
      if (status.mps_msgcount) throw std::runtime_error("unread group surface packets");
    }
    if (!closeAttempted_) {
      closeAttempted_ = true;
      if (receiver_) {
        if (mach_port_mod_refs(mach_task_self(), receiver_, MACH_PORT_RIGHT_RECEIVE, -1) == KERN_SUCCESS) receiver_ = 0;
        else closeFailed_ = true;
      }
      if (demand_) {
        if (mach_port_deallocate(mach_task_self(), demand_) == KERN_SUCCESS) demand_ = 0;
        else closeFailed_ = true;
      }
    }
    if (closeFailed_) throw std::runtime_error("group receiver close uncertain");
  }
  ~GroupSurfaceReceiver() {
    // Only process teardown can discard a receiver with uncertain consumers.
    // Normal close refuses it; sender teardown keeps its budget quarantined.
    for (const auto& item : held_) { CFRelease(item.second.frame.surface); mach_port_deallocate(mach_task_self(), item.second.reply); }
    held_.clear();
    if (!closeAttempted_) {
      if (receiver_) mach_port_mod_refs(mach_task_self(), receiver_, MACH_PORT_RIGHT_RECEIVE, -1);
      if (demand_) mach_port_deallocate(mach_task_self(), demand_);
    }
  }
};
