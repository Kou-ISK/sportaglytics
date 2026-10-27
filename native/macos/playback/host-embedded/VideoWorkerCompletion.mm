#import "VideoWorkerCompletion.hpp"
#import "NativeSupport.hpp"
void requireVideoWorkerClosed(NSDictionary*r,BOOL direct){
 if(direct){
  require([r[@"executionKind"]isEqualToString:@"in-process-avframe"],@"wrong direct worker kind");
  require(!r[@"actualExitKnown"]&&!r[@"pipeCloseConfirmed"]&&!r[@"rawEOF"]&&!r[@"metadataEOF"]&&!r[@"exit"],@"in-process worker carried child-exit evidence");
  require([r[@"workerReturned"]boolValue]&&[r[@"resourcesReleased"]boolValue],@"direct worker return/resources unknown");
 }else{
  require(!r[@"executionKind"]||[r[@"executionKind"]isEqualToString:@"external-child"],@"wrong external worker kind");
  require([r[@"actualExitKnown"]boolValue]&&[r[@"pipeCloseConfirmed"]boolValue],@"producer exit/pipe close unknown");
 }
}
void requireVideoRangeComplete(NSDictionary*r,BOOL direct,size_t expected){
 requireVideoWorkerClosed(r,direct);
 require([r[@"success"]boolValue]&&![r[@"cancelled"]boolValue]&&[r[@"completedRequestedRange"]boolValue],@"video range did not complete successfully");
 if(direct){require([r[@"fields"]unsignedLongLongValue]==expected,@"direct range field count");}
 else{require(diagnostic::completeRange(false,[r[@"rawEOF"]boolValue],[r[@"metadataEOF"]boolValue],[r[@"actualExitKnown"]boolValue],[r[@"exit"]intValue],[r[@"fields"]unsignedLongLongValue],expected),@"continuous range count/EOF/exit");}
}
