#include "ControlOutput.hpp"
#include <cassert>
#include <csignal>
#include <fcntl.h>
int main() {
  signal(SIGPIPE, SIG_IGN);
  int fds[2]; assert(pipe(fds) == 0);
  assert(fcntl(fds[1], F_SETFL, O_NONBLOCK) == 0);
  appleplayback::ControlOutput output;
  output.push("{\"status\":1}");
  assert(output.flush(fds[1]) == appleplayback::FlushResult::drained);
  char data[64]; ssize_t length = read(fds[0], data, sizeof(data));
  assert(std::string(data, length) == "{\"status\":1}\n");
  std::string fill(4096, 'x');
  while (write(fds[1], fill.data(), fill.size()) > 0) {}
  output.push("pending");
  assert(output.flush(fds[1]) == appleplayback::FlushResult::waiting);
  assert(output.count() == 1);
  close(fds[0]);
  assert(output.flush(fds[1]) == appleplayback::FlushResult::disconnected);
  close(fds[1]);
  for (int i = 0; i < 7; i++) output.push("bounded");
  bool rejected = false;
  try { output.push("overflow"); } catch (const std::runtime_error &) { rejected = true; }
  assert(rejected && output.count() == 8);
}
