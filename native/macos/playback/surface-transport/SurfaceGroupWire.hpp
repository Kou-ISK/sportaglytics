#pragma once
#include "SurfaceWire.hpp"

// Separate protocol, not a reinterpretation of v1's singleton stream.
namespace groupsurfacewire {
constexpr int Frame = 7401, Drawn = 7402, Released = 7403, Request = 7404;
constexpr size_t Angles = 2, Limit = 6;
constexpr uint64_t MaximumSources = 32;
constexpr uint64_t MaximumSequence = 9007199254740991ULL;
constexpr uint64_t MaximumTicks = 86400ULL * 120000;
enum class Content : uint64_t { Image = 1, Blank = 2 };
struct Identity {
  uint64_t id, operation, seek, pair, angle, sourceEpoch, sourceIndex;
  uint64_t sourcePTS, sourceEndPTS, globalTicks, globalStart, globalEnd;
  Content content;
};
inline bool valid(const Identity& v) {
  return v.id && v.id <= MaximumSequence && v.operation &&
    v.operation <= MaximumSequence && v.seek && v.seek <= MaximumSequence &&
    v.pair && v.pair <= MaximumSequence &&
    v.angle < Angles && v.sourceEpoch && v.sourceEpoch <= MaximumSequence &&
    v.globalTicks <= MaximumTicks && v.globalEnd <= MaximumTicks &&
    v.globalStart <= v.globalTicks && v.globalTicks < v.globalEnd &&
    ((v.content == Content::Image && v.sourceIndex < MaximumSources && v.sourcePTS < v.sourceEndPTS &&
       v.sourceEndPTS <= MaximumTicks &&
       v.globalEnd - v.globalStart <= v.sourceEndPTS - v.sourcePTS + 1) ||
      (v.content == Content::Blank && v.sourceIndex == MaximumSources && v.sourcePTS == 0 && v.sourceEndPTS == 0));
}
struct FrameMessage {
  mach_msg_header_t header;
  mach_msg_body_t body;
  mach_msg_port_descriptor_t surface, reply;
  Identity identity;
};
inline kern_return_t configureReplyQueue(mach_port_t port) {
  mach_port_limits_t limits{Limit * 3 + 1};
  return mach_port_set_attributes(mach_task_self(), port, MACH_PORT_LIMITS_INFO,
    reinterpret_cast<mach_port_info_t>(&limits), MACH_PORT_LIMITS_INFO_COUNT);
}
}
