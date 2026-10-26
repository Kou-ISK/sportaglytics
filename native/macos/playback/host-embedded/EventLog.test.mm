#import "NativeSupport.hpp"
#include <cassert>

int main() {
  @autoreleasepool {
    EventLog* product = [[EventLog alloc] initWithRolling:YES recordDetails:NO];
    EventLog* proof = [[EventLog alloc] initWithRolling:YES];
    for (int i = 0; i < 18001; ++i) {
      @autoreleasepool {
        NSDictionary* value = @{@"field": @(i), @"synthetic": @YES};
        [product add:@"fixture" values:value];
        [proof add:@"fixture" values:value];
      }
    }
    assert(product.count == 18001 && [product snapshot].count == 0);
    assert(!product.overflowed);
    assert(proof.count == 18001 && [proof snapshot].count == 18000);
    assert(proof.overflowed);
    assert([[[proof snapshot] firstObject][@"field"] intValue] == 1);
  }
  return 0;
}
