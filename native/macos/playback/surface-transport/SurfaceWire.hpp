#pragma once
#include <mach/mach.h>
#include <bsm/libbsm.h>
#include <cstdint>
#include <cstring>
namespace surfacewire {
constexpr int Frame = 7301, Drawn = 7302, Released = 7303, Request = 7304;
constexpr size_t Limit = 3;
// Each held frame may queue a draw ACK, GPU-release ACK and the next demand.
// Reserve one already-pending demand as well. This holds no additional images.
constexpr mach_port_msgcount_t ReplyQueueLimit = Limit * 3 + 1;
inline kern_return_t configureReplyQueue(mach_port_t port) {
 mach_port_limits_t limits{ReplyQueueLimit};
 return mach_port_set_attributes(mach_task_self(), port, MACH_PORT_LIMITS_INFO,
   reinterpret_cast<mach_port_info_t>(&limits), MACH_PORT_LIMITS_INFO_COUNT);
}
inline bool hasFrameCredit(size_t held){return held<Limit;}
struct FrameMessage {
  mach_msg_header_t header;
  mach_msg_body_t body;
  mach_msg_port_descriptor_t surface;
  mach_msg_port_descriptor_t reply;
  uint64_t id, generation, seek, pts;
};
struct Ack { mach_msg_header_t header; uint64_t id; };
template<class T> struct Receive { T message; mach_msg_max_trailer_t trailer; };
inline mach_msg_option_t receiveOptions() {
  return MACH_RCV_MSG | MACH_RCV_TIMEOUT | MACH_RCV_TRAILER_TYPE(MACH_MSG_TRAILER_FORMAT_0) | MACH_RCV_TRAILER_ELEMENTS(MACH_RCV_TRAILER_AUDIT);
}
inline bool fromPeer(mach_msg_header_t* h, size_t expected, pid_t peer) {
  if(h->msgh_size != expected || peer <= 0) return false;
  auto* trailer=reinterpret_cast<mach_msg_audit_trailer_t*>(reinterpret_cast<char*>(h)+round_msg(h->msgh_size));
  return trailer->msgh_trailer_type == MACH_MSG_TRAILER_FORMAT_0 && trailer->msgh_trailer_size >= sizeof(mach_msg_audit_trailer_t) && audit_token_to_pid(trailer->msgh_audit)==peer;
}
inline kern_return_t reply(mach_port_t port, uint64_t id, int kind) {
  Ack a{}; a.header.msgh_bits=MACH_MSGH_BITS(MACH_MSG_TYPE_COPY_SEND,0); a.header.msgh_size=sizeof(a); a.header.msgh_remote_port=port;a.header.msgh_id=kind;a.id=id;
  return mach_msg(&a.header,MACH_SEND_MSG|MACH_SEND_TIMEOUT,sizeof(a),0,MACH_PORT_NULL,0,MACH_PORT_NULL);
}
}
