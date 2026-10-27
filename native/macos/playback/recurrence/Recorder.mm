#include "Recorder.hpp"
#include <dispatch/dispatch.h>
#include <sys/stat.h>
#include <sys/resource.h>
#include <sys/socket.h>
#include <unistd.h>
#include <fcntl.h>
#include <poll.h>
#include <cerrno>
namespace recurrence {
static int output=-1;
void configure(bool enabled,uint64_t session)noexcept{
 if(!enabled||!session||active)return;struct stat s{};
 if(fstat(3,&s)||!(S_ISFIFO(s.st_mode)||S_ISSOCK(s.st_mode)))return;
 // Cap the private auxiliary socket buffer; if unavailable, disable only
 // this diagnostic. Never change the control or media transport sockets.
 if(S_ISSOCK(s.st_mode)){int size=32768;socklen_t length=sizeof(size);if(setsockopt(3,SOL_SOCKET,SO_SNDBUF,&size,sizeof(size))||getsockopt(3,SOL_SOCKET,SO_SNDBUF,&size,&length)||size>131072)return;}
 int flags=fcntl(3,F_GETFL);if(flags<0||fcntl(3,F_SETFL,flags|O_NONBLOCK)<0||fcntl(3,F_SETNOSIGPIPE,1)<0)return;
 try{active=std::make_shared<Recorder>(session);output=3;}catch(...){output=-1;}
}
void capture(uint64_t reason)noexcept{
 if(!active||output<0||!active->freeze(reason))return;
 auto recorder=active;int fd=output;output=-1;
 // No owner queue waits for this diagnostic. Incomplete IPC is explicitly
 // identified by the receiver; required media/drain receipts are unchanged.
 dispatch_async(dispatch_get_global_queue(QOS_CLASS_UTILITY,0),^{
  auto deadline=std::chrono::steady_clock::now()+std::chrono::milliseconds(250);
  recorder->dump([&](const void*bytes,size_t size){auto p=static_cast<const char*>(bytes);unsigned attempts=0;while(size){
   if(++attempts>512||std::chrono::steady_clock::now()>=deadline)return false;
   ssize_t n=write(fd,p,size);if(n>0){p+=n;size-=n;continue;}
   if(n<0&&(errno==EAGAIN||errno==EINTR)){pollfd event{fd,POLLOUT,0};poll(&event,1,2);continue;}return false;
  }return true;});close(fd);
 });
}
void resourceSample()noexcept{
 if(!active||active->frozen())return;static auto next=std::chrono::steady_clock::time_point{};
 auto now=std::chrono::steady_clock::now();if(now<next)return;next=now+std::chrono::seconds(1);
 rusage u{};if(getrusage(RUSAGE_SELF,&u))return;
 note(3,80,0,0,u.ru_utime.tv_sec*1000000LL+u.ru_utime.tv_usec,u.ru_stime.tv_sec*1000000ULL+u.ru_stime.tv_usec);
 note(3,81,0,0,u.ru_maxrss,u.ru_minflt);
}
}
