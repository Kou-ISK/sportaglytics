#include <sys/stat.h>
#include <unistd.h>
#include <errno.h>
#include <poll.h>
#include <stdio.h>
#include <string.h>
// Synthetic transport fixture only: same low-level read/poll contract as host.
int main(int argc,char **argv) {
  struct stat st;
  if(fstat(0,&st)||!S_ISFIFO(st.st_mode))return 65;
  if(argc==2&&!strcmp(argv[1],"reject"))return 65;
  for(int ticks=0;ticks<500;ticks++) {
    char bytes[4096];ssize_t n=read(0,bytes,sizeof(bytes));
    if(n==0)return 0;
    if(n>0){if(write(1,bytes,n)!=n)return 66;}
    else if(errno!=EAGAIN&&errno!=EINTR)return 67;
    struct pollfd p={0,POLLIN,0};poll(&p,1,10);
  }
  return 68;
}
