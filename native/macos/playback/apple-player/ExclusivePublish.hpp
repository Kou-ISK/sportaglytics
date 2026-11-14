#pragma once
#include <cerrno>
#include <cstdlib>
#include <cstring>
#include <fcntl.h>
#include <string>
#include <sys/stat.h>
#include <sys/stdio.h>
#include <unistd.h>

// Dedicated export mode. All path components are opened relative to held
// directory descriptors; the source identity must match Main's observation.
inline int runExclusivePublish(int argc, const char **argv) {
  if (argc != 14) return 64;
  const std::string parent(argv[2]), stagingDir(argv[3]), source(argv[4]), target(argv[5]);
  const auto component = [](const std::string &s) {
    return !s.empty() && s != "." && s != ".." && s.find('/') == std::string::npos;
  };
  if (parent.empty() || parent[0] != '/' || !component(stagingDir) ||
      !component(source) || !component(target) ||
      (stagingDir.rfind(".sportag-export-", 0) != 0 && stagingDir.rfind(".sportaglytics-export-", 0) != 0) ||
      (source != "output.mp4" && source != "clip.mp4")) return 64;
  int parentFd = open("/", O_RDONLY | O_DIRECTORY | O_CLOEXEC);
  if (parentFd < 0) return 74;
  size_t pos = 1;
  while (pos < parent.size()) {
    const size_t end = parent.find('/', pos);
    const std::string name = parent.substr(pos, end == std::string::npos ? end : end - pos);
    if (!component(name)) { close(parentFd); return 64; }
    const int next = openat(parentFd, name.c_str(), O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC);
    close(parentFd);
    if (next < 0) return 74;
    parentFd = next;
    if (end == std::string::npos) break;
    pos = end + 1;
  }
  const int stageFd = openat(parentFd, stagingDir.c_str(), O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC);
  if (stageFd < 0) { close(parentFd); return 74; }
  struct stat file{}, parentStat{}, stageStat{};
  unsigned long long values[7]{};
  for (int index = 0; index < 7; index++) {
    const char *value = argv[index + 6];
    if (!*value || strspn(value, "0123456789") != strlen(value)) { close(stageFd); close(parentFd); return 64; }
    char *end = nullptr; errno = 0; values[index] = strtoull(value, &end, 10);
    if (errno || !end || *end) { close(stageFd); close(parentFd); return 64; }
  }
  if (strcmp(argv[13], "v1")) { close(stageFd); close(parentFd); return 64; }
  if (fstat(parentFd, &parentStat) || fstat(stageFd, &stageStat) ||
      stageStat.st_uid != geteuid() || (stageStat.st_mode & 0077) != 0 ||
      fstatat(stageFd, source.c_str(), &file, AT_SYMLINK_NOFOLLOW) ||
      !S_ISREG(file.st_mode) || file.st_nlink != 1 || file.st_size <= 0 ||
      static_cast<unsigned long long>(file.st_dev) != values[0] ||
      static_cast<unsigned long long>(file.st_ino) != values[1] ||
      static_cast<unsigned long long>(file.st_size) != values[2] ||
      static_cast<unsigned long long>(parentStat.st_dev) != values[3] ||
      static_cast<unsigned long long>(parentStat.st_ino) != values[4] ||
      static_cast<unsigned long long>(stageStat.st_dev) != values[5] ||
      static_cast<unsigned long long>(stageStat.st_ino) != values[6] ||
      parentStat.st_dev != stageStat.st_dev) {
    close(stageFd); close(parentFd); return 74;
  }
  const int result = renameatx_np(stageFd, source.c_str(), parentFd, target.c_str(), RENAME_EXCL | RENAME_NOFOLLOW_ANY);
  const int saved = errno;
  close(stageFd); close(parentFd);
  if (result == 0) { (void)write(STDOUT_FILENO, "PUB1:OK\n", 8); return 0; }
  if (saved == EEXIST || saved == ENOTEMPTY) return 73;
  if (saved == ENOTSUP || saved == EOPNOTSUPP || saved == EXDEV) return 78;
  return 74;
}
