#pragma once
#include "GroupSurfaceReceiver.hpp"
#include <node_api.h>
#include <cmath>
#include <memory>
#include <string>
#include <utility>

// Main actor only, same as the legacy addon. Every v2 call is bound to the
// exact opening service so one failed/old owner cannot close another group.
namespace groupreceiverbridge {
inline std::unique_ptr<GroupSurfaceReceiver> current;
inline std::string currentService;
inline napi_value fail(napi_env env, const char* reason) {
  napi_throw_error(env, nullptr, reason); return nullptr;
}
inline napi_value none(napi_env env) { napi_value value; napi_get_null(env, &value); return value; }
template<class F> napi_value guard(napi_env env, F work) {
  try { return work(); }
  catch (const std::exception& error) { return fail(env, error.what()); }
}
struct Arguments { std::string service; uint64_t id; };
inline Arguments arguments(napi_env env, napi_callback_info info, bool withID) {
  size_t count = 3, length = 0; napi_value values[3]; char name[128];
  if (napi_get_cb_info(env, info, &count, values, nullptr, nullptr) != napi_ok || count != (withID ? 2U : 1U) ||
      napi_get_value_string_utf8(env, values[0], name, sizeof(name), &length) != napi_ok ||
      length < 36 || length >= sizeof(name) - 1 || strlen(name) != length)
    throw std::runtime_error("invalid group service arguments");
  uint64_t identifier = 0;
  if (withID) {
    double value = 0;
    if (napi_get_value_double(env, values[1], &value) != napi_ok || !std::isfinite(value) ||
        value < 1 || value > groupsurfacewire::MaximumSequence || value != uint64_t(value))
      throw std::runtime_error("invalid group identifier");
    identifier = uint64_t(value);
  }
  return {std::string(name, length), identifier};
}
inline GroupSurfaceReceiver& receiver(const std::string& service) {
  if (!current || service != currentService) throw std::runtime_error("group receiver owner changed");
  return *current;
}
inline napi_value open(napi_env env, napi_callback_info info, bool legacyOpen) {
  return guard(env, [&] {
    auto args = arguments(env, info, false);
    if (legacyOpen || current) throw std::runtime_error("native receiver already open");
    auto created = std::make_unique<GroupSurfaceReceiver>();
    currentService = std::move(args.service); current = std::move(created);
    current->open(currentService.c_str()); return none(env);
  });
}
inline napi_value peer(napi_env env, napi_callback_info info) {
  return guard(env, [&] {
    auto args = arguments(env, info, true);
    if (args.id > INT32_MAX) throw std::runtime_error("invalid group peer");
    receiver(args.service).setPeer(pid_t(args.id)); return none(env);
  });
}
inline void number(napi_env env, napi_value object, const char* key, uint64_t value) {
  napi_value item;
  if (napi_create_double(env, double(value), &item) != napi_ok || napi_set_named_property(env, object, key, item) != napi_ok)
    throw std::runtime_error("group metadata allocation failed");
}
inline napi_value poll(napi_env env, napi_callback_info info) {
  return guard(env, [&] {
    auto args = arguments(env, info, false); auto frame = receiver(args.service).poll();
    if (!frame) return none(env);
    napi_value out, handle;
    if (napi_create_object(env, &out) != napi_ok ||
        napi_create_buffer_copy(env, sizeof(frame->surface), &frame->surface, nullptr, &handle) != napi_ok ||
        napi_set_named_property(env, out, "handle", handle) != napi_ok)
      throw std::runtime_error("group metadata allocation failed");
    const auto& v = frame->identity;
    number(env, out, "id", v.id); number(env, out, "operation", v.operation); number(env, out, "seekId", v.seek);
    number(env, out, "pair", v.pair); number(env, out, "angle", v.angle); number(env, out, "sourceEpoch", v.sourceEpoch);
    number(env, out, "sourceIndex", v.sourceIndex); number(env, out, "sourcePTS", v.sourcePTS);
    number(env, out, "sourceEndPTS", v.sourceEndPTS); number(env, out, "globalTicks", v.globalTicks);
    number(env, out, "globalStart", v.globalStart); number(env, out, "globalEnd", v.globalEnd);
    number(env, out, "content", uint64_t(v.content)); number(env, out, "surfaceID", IOSurfaceGetID(frame->surface));
    if (IOSurfaceGetHeight(frame->surface) == 720) number(env, out, "surfaceHeight", 720);
    return out;
  });
}
inline napi_value drawn(napi_env env, napi_callback_info info) {
  return guard(env, [&] { auto a = arguments(env, info, true); receiver(a.service).drawn(a.id); return none(env); });
}
inline napi_value release(napi_env env, napi_callback_info info) {
  return guard(env, [&] { auto a = arguments(env, info, true); receiver(a.service).release(a.id); return none(env); });
}
inline napi_value request(napi_env env, napi_callback_info info) {
  return guard(env, [&] { auto a = arguments(env, info, false); receiver(a.service).request(); return none(env); });
}
inline napi_value count(napi_env env, napi_callback_info info) {
  return guard(env, [&] { auto a = arguments(env, info, false); napi_value value; napi_create_uint32(env, receiver(a.service).count(), &value); return value; });
}
inline napi_value close(napi_env env, napi_callback_info info) {
  return guard(env, [&] {
    auto a = arguments(env, info, false);
    if (current) { receiver(a.service).close(); current.reset(); currentService.clear(); }
    return none(env);
  });
}
}
