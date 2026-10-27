#pragma once
#include <libproc.h>
#include <sys/resource.h>
#include <cerrno>
#include <cmath>
#include <cstdint>
#include <optional>

namespace diagnostic {
// Private observation only. The caller supplies its live NSTask PID, never UI input.
// XNU exposes these counters in Mach absolute units, not nanoseconds. Preserve
// the raw counters and record mach_timebase_info separately for interpretation.
struct ProducerCPUReading { uint64_t user, system, processStart; };
class OwnedProducerCPU {
 public:
  using Read = int (*)(int, int, rusage_info_t*);
  explicit OwnedProducerCPU(int ownedPID, Read read = proc_pid_rusage): pid_(ownedPID), read_(read) {}
  std::optional<ProducerCPUReading> sample(double now, bool running, bool cancelled) {
    if (stopped_ || count_ >= 300) return std::nullopt;
    if (pid_ <= 0 || !running || cancelled || !std::isfinite(now)) {
      stopped_ = true; reason_ = "owner ended/cancelled/invalid"; return std::nullopt;
    }
    if (now < next_) return std::nullopt;
    next_ = now + 0.1; ++count_;
    rusage_info_v0 usage{};
    if (read_(pid_, RUSAGE_INFO_V0, reinterpret_cast<rusage_info_t*>(&usage)) != 0) {
      error_ = errno; stopped_ = true; reason_ = "CPU counter unavailable"; return std::nullopt;
    }
    if (!usage.ri_proc_start_abstime || usage.ri_proc_exit_abstime ||
        (start_ && start_ != usage.ri_proc_start_abstime)) {
      stopped_ = true; reason_ = "process identity changed/ended"; return std::nullopt;
    }
    start_ = usage.ri_proc_start_abstime;
    return ProducerCPUReading{usage.ri_user_time, usage.ri_system_time, start_};
  }
  int attempts() const { return count_; }
  int error() const { return error_; }
  const char* reason() const { return count_ >= 300 ? "sample bound reached" : reason_; }
 private:
  int pid_, count_ = 0, error_ = 0;
  Read read_;
  uint64_t start_ = 0;
  double next_ = 0;
  bool stopped_ = false;
  const char* reason_ = "available";
};
}
