#pragma once
#include <sys/socket.h>
#include <fcntl.h>
#include <unistd.h>
#include <cerrno>
#include <stdexcept>
#include <initializer_list>

namespace diagnostic {
// The borrowed Foundation writer handle must use closeOnDealloc:NO. This ledger
// is the only FD owner, including setup/launch failure and uncertain close.
class OwnedRawDescriptor {
 int fd_=-1,error_=0;bool attempted_=false,closed_=false;
 int (*close_)(int);
public:
 explicit OwnedRawDescriptor(int (*closeFunction)(int)=::close):close_(closeFunction){}
 OwnedRawDescriptor(const OwnedRawDescriptor&)=delete;
 OwnedRawDescriptor& operator=(const OwnedRawDescriptor&)=delete;
 ~OwnedRawDescriptor(){closeOnce();}
 void own(int fd){if(fd<0||fd_>=0)throw std::logic_error("raw FD ownership");fd_=fd;}
 int fd()const{return attempted_?-1:fd_;}
 bool closeOnce()noexcept{
  if(fd_<0)return true;if(attempted_)return closed_;attempted_=true;
  if(close_(fd_)==0){closed_=true;return true;}error_=errno;return false;
 }
 bool confirmed()const{return fd_<0||closed_;}
 int closeError()const{return error_;}
};
class RawSocketOutput {
 OwnedRawDescriptor reader_,writer_;bool opened_=false;
 int sendBytes_=0,receiveBytes_=0;
public:
 static constexpr int MaximumBufferBytes=256*1024;
 void open(int requestedBytes=MaximumBufferBytes){
  if(opened_)throw std::logic_error("raw socket already opened");opened_=true;
  int pair[2]={-1,-1};if(socketpair(AF_UNIX,SOCK_STREAM,0,pair)!=0)throw std::runtime_error("raw socketpair failed");
  reader_.own(pair[0]);writer_.own(pair[1]);
  // Validate after ownership begins so every partial setup has one cleanup path.
  if(requestedBytes<=0||requestedBytes>MaximumBufferBytes)throw std::out_of_range("raw socket buffer request");
  for(int fd:{reader_.fd(),writer_.fd()}){
   int flags=fcntl(fd,F_GETFD);if(flags<0||fcntl(fd,F_SETFD,flags|FD_CLOEXEC)!=0)throw std::runtime_error("raw socket CLOEXEC");
  }
  if(setsockopt(writer_.fd(),SOL_SOCKET,SO_SNDBUF,&requestedBytes,sizeof(requestedBytes))!=0||
     setsockopt(reader_.fd(),SOL_SOCKET,SO_RCVBUF,&requestedBytes,sizeof(requestedBytes))!=0)throw std::runtime_error("raw socket buffer setup");
  socklen_t sendSize=sizeof(sendBytes_),receiveSize=sizeof(receiveBytes_);
  if(getsockopt(writer_.fd(),SOL_SOCKET,SO_SNDBUF,&sendBytes_,&sendSize)!=0||
     getsockopt(reader_.fd(),SOL_SOCKET,SO_RCVBUF,&receiveBytes_,&receiveSize)!=0||
     sendSize!=sizeof(sendBytes_)||receiveSize!=sizeof(receiveBytes_)||
     sendBytes_<=0||receiveBytes_<=0||sendBytes_>MaximumBufferBytes||receiveBytes_>MaximumBufferBytes)throw std::runtime_error("raw socket actual buffer bound");
 }
 int readerFD()const{return reader_.fd();}
 int writerFD()const{return writer_.fd();}
 int sendBytes()const{return sendBytes_;}
 int receiveBytes()const{return receiveBytes_;}
 bool closeWriter()noexcept{return writer_.closeOnce();}
 bool closeReader()noexcept{return reader_.closeOnce();}
 bool confirmed()const{return reader_.confirmed()&&writer_.confirmed();}
 int writerCloseError()const{return writer_.closeError();}
 int readerCloseError()const{return reader_.closeError();}
};
}
