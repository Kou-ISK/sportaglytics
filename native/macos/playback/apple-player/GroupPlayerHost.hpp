#pragma once
#import <Foundation/Foundation.h>
#include <csignal>
// Separate placed-pair Host protocol. Not advertised as package/clip-switch
// capability until Main/controller negotiation and lifecycle are connected.
int runAppleGroupHost(NSDictionary *manifest, NSString *result,
                      volatile sig_atomic_t *interrupted);
