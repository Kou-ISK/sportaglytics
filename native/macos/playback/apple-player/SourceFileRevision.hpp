#pragma once
#import <Foundation/Foundation.h>
#include <sys/stat.h>
#include <optional>
#include <string>

namespace appleplayback {
inline std::string decimalNanoseconds(const timespec &time) {
  __int128 value = __int128(time.tv_sec) * 1000000000 + time.tv_nsec;
  const bool negative = value < 0; if (negative) value = -value;
  char digits[40]; size_t count = 0;
  do { digits[count++] = char('0' + value % 10); value /= 10; } while (value);
  std::string result = negative ? "-" : "";
  while (count) result += digits[--count]; return result;
}
/// Same decimal fields as Main's cacheFileRevision(BigIntStats). This detects
/// ordinary local replacement/modification and rejects a symlink leaf. It is
/// not an exclusive file reservation against arbitrary same-UID ancestor swaps.
inline std::optional<std::string> sourceFileRevision(NSURL *url) {
  struct stat value{};
  if (!url.isFileURL || !url.fileSystemRepresentation || lstat(url.fileSystemRepresentation, &value) ||
      !S_ISREG(value.st_mode) || value.st_size <= 0 || !value.st_nlink) return std::nullopt;
  return std::to_string(uint64_t(value.st_dev)) + ":" + std::to_string(uint64_t(value.st_ino)) + ":" +
    std::to_string(value.st_size) + ":" + decimalNanoseconds(value.st_mtimespec) + ":" +
    decimalNanoseconds(value.st_ctimespec) + ":" + std::to_string(uint64_t(value.st_nlink));
}
inline bool sourceFileMatches(NSURL *url, const std::string &expected) {
  const auto actual = sourceFileRevision(url); return actual && *actual == expected;
}
}
