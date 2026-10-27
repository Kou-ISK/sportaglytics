#pragma once
#import <Foundation/Foundation.h>
#include "FrameDeliveryBudget.hpp"
// One lease is shared by both owner queues and any pending delivery callback.
// Release is based on lifetime, not display count or playback rate.
@interface FrameDeliveryLease:NSObject
-(instancetype)initWithPermit:(std::shared_ptr<directframe::FrameDeliveryBudget::Permit>)permit;
@end
