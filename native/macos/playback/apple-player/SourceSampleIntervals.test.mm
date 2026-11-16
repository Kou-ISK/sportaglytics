#import "SampleIntervalFixture.hpp"
int main() { @autoreleasepool {
  NSString* directory = [NSTemporaryDirectory() stringByAppendingPathComponent:[@"sportag-sample-index-" stringByAppendingString:NSUUID.UUID.UUIDString]];
  assert([[NSFileManager defaultManager] createDirectoryAtPath:directory withIntermediateDirectories:NO attributes:nil error:nil]);
  auto url = [NSURL fileURLWithPath:[directory stringByAppendingPathComponent:@"vfr.mov"]]; fixture(url, true);
  auto index = [[STSourceSampleIntervals alloc] initWithURL:url];
  assert([index request:2002] && ![index request:6006]); drained(index); assert(!index.failed);
  auto a = [index lookup:2002], b = [index lookup:6006];
  assert(a && a->start == 2002 && a->end == 6006);
  assert(b && b->start == 6006 && b->end == 8008);
  assert(![index request:2002]); // cached timing does not start another disk scan
  assert(![index lookup:2003]); // arbitrary requested clock is not an output PTS
  [index cancel]; assert(![index lookup:2002] && ![index request:2002]);
  auto cancelled = [[STSourceSampleIntervals alloc] initWithURL:url];
  auto other = [[STSourceSampleIntervals alloc] initWithURL:url];
  assert([cancelled request:0] && [other request:6006]); [cancelled cancel]; drained(cancelled); drained(other);
  assert(![cancelled lookup:0] && ![cancelled request:0]);
  auto independent = [other lookup:6006]; assert(!other.failed && independent && independent->end == 8008);
  [other cancel];
  auto missing = [[STSourceSampleIntervals alloc] initWithURL:[NSURL fileURLWithPath:[directory stringByAppendingPathComponent:@"absent.mov"]]];
  assert([missing request:0]); drained(missing); assert(missing.failed && ![missing lookup:0]);
  [missing cancel];
  auto unmatched = [[STSourceSampleIntervals alloc] initWithURL:url];
  assert([unmatched request:2003]); drained(unmatched); assert(unmatched.failed && unmatched.failure == appleplayback::SourceSampleFailure::RequestedPTSAbsent && ![unmatched request:2003]);
  [unmatched cancel];
  // An explicit coarse 600 Hz movie/track clock quantizes this fixture.
  // Index the actual output clock rather than pretending the input PTS survived.
  auto coarseURL = [NSURL fileURLWithPath:[directory stringByAppendingPathComponent:@"coarse-vfr.mov"]]; fixture(coarseURL, false);
  auto coarse = [[STSourceSampleIntervals alloc] initWithURL:coarseURL];
  assert([coarse request:2000]); drained(coarse); assert(!coarse.failed);
  auto measured = [coarse lookup:2000];
  assert(measured && measured->start == 2000 && measured->end == 6000 && ![coarse lookup:2002]);
  [coarse cancel];
  // Only this test's newly created fixture, after writer/index drainage.
  assert([[NSFileManager defaultManager] removeItemAtURL:url error:nil]);
  assert([[NSFileManager defaultManager] removeItemAtURL:coarseURL error:nil]);
  assert([[NSFileManager defaultManager] removeItemAtPath:directory error:nil]);
  puts("SourceSampleIntervals: actual VFR intervals, no invented PTS, cancellation and missing source passed");
} }
