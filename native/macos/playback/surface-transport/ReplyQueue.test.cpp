#include "SurfaceWire.hpp"
#include <cassert>
#include <cstdio>
#include <unistd.h>

int main() {
 mach_port_t port = MACH_PORT_NULL;
 assert(mach_port_allocate(mach_task_self(), MACH_PORT_RIGHT_RECEIVE, &port) == KERN_SUCCESS);
 assert(mach_port_insert_right(mach_task_self(), port, port, MACH_MSG_TYPE_MAKE_SEND) == KERN_SUCCESS);
 assert(surfacewire::configureReplyQueue(port) == KERN_SUCCESS);
 assert(surfacewire::configureReplyQueue(MACH_PORT_NULL) != KERN_SUCCESS);
 mach_port_limits_t limits{};
 mach_msg_type_number_t count = MACH_PORT_LIMITS_INFO_COUNT;
 assert(mach_port_get_attributes(mach_task_self(), port, MACH_PORT_LIMITS_INFO,
   reinterpret_cast<mach_port_info_t>(&limits), &count) == KERN_SUCCESS);
 std::printf("reply queue slots: %u\n", limits.mpl_qlimit);
 // Three held surfaces can each produce draw/release/demand while the
 // producer is busy. One existing demand may already be queued.
 const size_t burst = surfacewire::ReplyQueueLimit;
 assert(limits.mpl_qlimit == burst);
 for (size_t i = 0; i < burst; ++i) {
  const auto result = surfacewire::reply(port, i + 1, surfacewire::Released);
  if (result != KERN_SUCCESS) std::fprintf(stderr, "reply %zu failed: %d\n", i + 1, result);
  assert(result == KERN_SUCCESS);
 }
 assert(surfacewire::reply(port, burst + 1, surfacewire::Released) == MACH_SEND_TIMED_OUT);
 for (size_t i = 0; i < burst; ++i) {
  surfacewire::Receive<surfacewire::Ack> packet{};
  assert(mach_msg(&packet.message.header, surfacewire::receiveOptions(), 0,
    sizeof(packet), port, 0, MACH_PORT_NULL) == KERN_SUCCESS);
  assert(packet.message.id == i + 1);
  assert(surfacewire::fromPeer(&packet.message.header, sizeof(packet.message), getpid()));
  assert(!surfacewire::fromPeer(&packet.message.header, sizeof(packet.message), getpid() + 1));
 }
 assert(mach_port_deallocate(mach_task_self(), port) == KERN_SUCCESS);
 assert(mach_port_mod_refs(mach_task_self(), port, MACH_PORT_RIGHT_RECEIVE, -1) == KERN_SUCCESS);
}
