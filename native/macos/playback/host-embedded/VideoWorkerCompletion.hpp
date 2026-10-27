#pragma once
#import <Foundation/Foundation.h>
// Checks lifecycle evidence before the controller may release worker ownership.
void requireVideoWorkerClosed(NSDictionary*report,BOOL direct);
void requireVideoRangeComplete(NSDictionary*report,BOOL direct,size_t expected);
