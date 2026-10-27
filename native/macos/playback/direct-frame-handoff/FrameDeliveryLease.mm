#import "FrameDeliveryLease.hpp"
@implementation FrameDeliveryLease {
 std::shared_ptr<directframe::FrameDeliveryBudget::Permit> permit_;
}
-(instancetype)initWithPermit:(std::shared_ptr<directframe::FrameDeliveryBudget::Permit>)permit{
 if((self=[super init]))permit_=std::move(permit);
 return self;
}
@end
