#pragma once
#include <cerrno>
#include <deque>
#include <stdexcept>
#include <string>
#include <unistd.h>

namespace appleplayback {
enum class FlushResult { drained, waiting, disconnected };
class ControlOutput {
  std::deque<std::string> pending_;
  size_t offset_ = 0;
public:
  size_t count() const { return pending_.size(); }
  void push(std::string line) {
    if (line.size() >= 4096 || pending_.size() >= 8) throw std::runtime_error("playback response bound");
    line.push_back('\n'); pending_.push_back(std::move(line));
  }
  FlushResult flush(int descriptor) {
    while (!pending_.empty()) {
      const auto &line = pending_.front();
      ssize_t written = write(descriptor, line.data() + offset_, line.size() - offset_);
      if (written < 0 && (errno == EAGAIN || errno == EINTR)) return FlushResult::waiting;
      if (written <= 0) return FlushResult::disconnected;
      offset_ += written;
      if (offset_ != line.size()) return FlushResult::waiting;
      pending_.pop_front(); offset_ = 0;
    }
    return FlushResult::drained;
  }
};
}
