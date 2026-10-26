#import "NativeSupport.hpp"
std::atomic<bool> nativeInterrupted{false};
static_assert(std::atomic<bool>::is_always_lock_free,"signal flag must be lock-free");
@implementation EventLog { std::mutex lock_;NSMutableArray*entries_;double start_;bool overflow_,rolling_;uint64_t count_; }
-(instancetype)init{return [self initWithRolling:NO];}
-(instancetype)initWithRolling:(BOOL)rolling{if((self=[super init])){entries_=[NSMutableArray array];start_=mono();rolling_=rolling;}return self;}
-(void)add:(NSString*)event values:(NSDictionary*)values{std::lock_guard<std::mutex>g(lock_);uint64_t index=count_++;if(entries_.count>=18000){overflow_=true;if(!rolling_)return;}NSMutableDictionary*d=[values mutableCopy];d[@"event"]=event;d[@"wall"]=@(mono()-start_);d[@"eventIndex"]=@(index);if(entries_.count<18000)[entries_ addObject:d];else entries_[index%18000]=d;}
-(BOOL)overflowed{std::lock_guard<std::mutex>g(lock_);return overflow_;}
-(uint64_t)count{std::lock_guard<std::mutex>g(lock_);return count_;}
-(NSArray*)snapshot{std::lock_guard<std::mutex>g(lock_);if(!rolling_||!overflow_)return [entries_ copy];NSUInteger head=count_%18000;NSMutableArray*ordered=[NSMutableArray arrayWithArray:[entries_ subarrayWithRange:NSMakeRange(head,18000-head)]];[ordered addObjectsFromArray:[entries_ subarrayWithRange:NSMakeRange(0,head)]];return ordered;}
@end
NSString* pixelHash(CVPixelBufferRef p){
 require(CVPixelBufferGetWidth(p)==1920&&CVPixelBufferGetHeight(p)==1080,@"display dimensions");
 OSType fmt=CVPixelBufferGetPixelFormatType(p);require(fmt==kCVPixelFormatType_420YpCbCr8Planar||fmt==kCVPixelFormatType_420YpCbCr8BiPlanarVideoRange,@"displayed format unsupported for exact hash");
 require(CVPixelBufferLockBaseAddress(p,kCVPixelBufferLock_ReadOnly)==0,@"display pixel lock");
 CC_SHA256_CTX c;CC_SHA256_Init(&c);
 @try{
  for(size_t plane=0;plane<3;plane++){
   size_t w=plane?960:1920,h=plane?540:1080;size_t pi=(fmt==kCVPixelFormatType_420YpCbCr8Planar)?plane:(plane?1:0);
   require(pi<CVPixelBufferGetPlaneCount(p),@"display plane count");require(CVPixelBufferGetWidthOfPlane(p,pi)==w&&CVPixelBufferGetHeightOfPlane(p,pi)==h,@"display plane dimensions");auto*b=(unsigned char*)CVPixelBufferGetBaseAddressOfPlane(p,pi);size_t stride=CVPixelBufferGetBytesPerRowOfPlane(p,pi);require(b&&stride>=w&&stride<=8192,@"display plane stride");
   unsigned char row[1920];for(size_t y=0;y<h;y++){if(fmt==kCVPixelFormatType_420YpCbCr8Planar||plane==0)CC_SHA256_Update(&c,b+y*stride,(CC_LONG)w);else{require(stride>=2*w,@"display interleaved stride");for(size_t x=0;x<w;x++)row[x]=b[y*stride+2*x+plane-1];CC_SHA256_Update(&c,row,(CC_LONG)w);}}
  }
 }@finally{require(CVPixelBufferUnlockBaseAddress(p,kCVPixelBufferLock_ReadOnly)==0,@"display pixel unlock");}
 unsigned char bytes[32];CC_SHA256_Final(bytes,&c);NSMutableString*s=[NSMutableString string];for(auto x:bytes)[s appendFormat:@"%02x",x];return s;
}
