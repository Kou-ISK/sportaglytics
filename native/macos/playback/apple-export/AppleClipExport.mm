#import <AVFoundation/AVFoundation.h>
#import <Foundation/Foundation.h>
#include <cmath>
#include <poll.h>
#include <sys/stat.h>
#include <unistd.h>

// Separate non-UI mode of the existing signed helper; no playback session,
// image queue, source conversion or renderer-selected executable is involved.
namespace {
bool numeric(id value) {
  return [value isKindOfClass:NSNumber.class] &&
    CFGetTypeID((__bridge CFTypeRef)value) != CFBooleanGetTypeID() &&
    std::isfinite([value doubleValue]);
}
bool parentConnected() {
  pollfd descriptor{STDIN_FILENO, POLLIN | POLLHUP | POLLERR, 0};
  return poll(&descriptor, 1, 0) >= 0 &&
    !(descriptor.revents & (POLLHUP | POLLERR | POLLNVAL));
}
bool awaitSignal(dispatch_semaphore_t signal, double deadline) {
  while (CFAbsoluteTimeGetCurrent() < deadline && parentConnected()) {
    if (!dispatch_semaphore_wait(signal, dispatch_time(DISPATCH_TIME_NOW, 10000000))) return true;
  }
  return false;
}
bool load(id<AVAsynchronousKeyValueLoading> object, NSArray<NSString *> *keys, double deadline) {
  dispatch_semaphore_t signal = dispatch_semaphore_create(0);
  [object loadValuesAsynchronouslyForKeys:keys completionHandler:^{ dispatch_semaphore_signal(signal); }];
  if (!awaitSignal(signal, deadline)) return false;
  for (NSString *key in keys) if ([object statusOfValueForKey:key error:nil] != AVKeyValueStatusLoaded) return false;
  return true;
}
CMTime time(double seconds) { return CMTimeMake(llround(seconds * 120000000.0), 120000000); }
bool covers(CMTimeRange available, CMTimeRange requested) {
  return CMTIMERANGE_IS_VALID(available) && CMTimeRangeContainsTimeRange(available, requested);
}
bool format(AVAssetTrack *track, FourCharCode codec) {
  NSArray *descriptions = track.formatDescriptions;
  return descriptions.count == 1 &&
    CMFormatDescriptionGetMediaSubType((__bridge CMFormatDescriptionRef)descriptions[0]) == codec;
}
bool safePath(id value) {
  return [value isKindOfClass:NSString.class] && [value length] > 0 &&
    [value length] <= 4096 && [value isAbsolutePath] &&
    [value rangeOfString:@"\0"].location == NSNotFound;
}
}

int runAppleClipExport(const char *requestPath) {
  @autoreleasepool {
    // Parent owns the pipe. EOF ends work even if Main exits during export.
    struct stat input, requestStat;
    if (fstat(STDIN_FILENO, &input) || !S_ISFIFO(input.st_mode) ||
        lstat(requestPath, &requestStat) || !S_ISREG(requestStat.st_mode) ||
        requestStat.st_size <= 0 || requestStat.st_size > 65536) return 65;
    NSData *data = [NSData dataWithContentsOfFile:@(requestPath)];
    if (!data || data.length > 65536) return 65;
    NSDictionary *request = [NSJSONSerialization JSONObjectWithData:data options:0 error:nil];
    NSSet *keys = [NSSet setWithArray:@[@"version", @"source", @"output", @"audioTrack", @"start", @"duration", @"maxOutputBytes"]];
    if (![request isKindOfClass:NSDictionary.class] ||
        ![[NSSet setWithArray:request.allKeys] isEqualToSet:keys] ||
        !numeric(request[@"version"]) || [request[@"version"] doubleValue] != 1 ||
        !numeric(request[@"start"]) || !numeric(request[@"duration"]) ||
        !numeric(request[@"audioTrack"]) || !numeric(request[@"maxOutputBytes"]) || !safePath(request[@"source"]) || !safePath(request[@"output"])) return 65;
    double start = [request[@"start"] doubleValue], duration = [request[@"duration"] doubleValue];
    double audioIndex = [request[@"audioTrack"] doubleValue];
    double maxOutputBytes = [request[@"maxOutputBytes"] doubleValue];
    if (start < 0 || start >= 86400 || duration <= 0 || duration > 7200 ||
        maxOutputBytes < 1 || maxOutputBytes > 8.0 * 1024 * 1024 * 1024 || maxOutputBytes != floor(maxOutputBytes) ||
        audioIndex < 0 || audioIndex > 63 || audioIndex != floor(audioIndex)) return 65;
    NSURL *sourceURL = [NSURL fileURLWithPath:request[@"source"]], *outputURL = [NSURL fileURLWithPath:request[@"output"]];
    if ([[NSFileManager defaultManager] fileExistsAtPath:outputURL.path]) return 65;
    AVURLAsset *asset = [AVURLAsset URLAssetWithURL:sourceURL options:@{AVURLAssetPreferPreciseDurationAndTimingKey:@YES}];
    const double deadline = CFAbsoluteTimeGetCurrent() + 110;
    if (!load(asset, @[@"tracks", @"duration", @"hasProtectedContent"], deadline) || asset.hasProtectedContent) {
      [asset cancelLoading]; return 1;
    }
    NSArray<AVAssetTrack *> *videos = [asset tracksWithMediaType:AVMediaTypeVideo], *audios = [asset tracksWithMediaType:AVMediaTypeAudio];
    if (videos.count != 1 || (NSUInteger)audioIndex >= audios.count) return 1;
    AVAssetTrack *video = videos[0], *audio = audios[(NSUInteger)audioIndex];
    if (!load(video, @[@"formatDescriptions", @"timeRange", @"naturalTimeScale", @"preferredTransform"], deadline) ||
        !load(audio, @[@"formatDescriptions", @"timeRange", @"naturalTimeScale"], deadline) ||
        !format(video, kCMVideoCodecType_H264) || !format(audio, kAudioFormatMPEG4AAC)) return 1;
    CMTimeRange range = CMTimeRangeMake(time(start), time(duration));
    if (!covers(video.timeRange, range) || !covers(audio.timeRange, range)) return 1;
    AVMutableComposition *composition = [AVMutableComposition composition];
    AVMutableCompositionTrack *v = [composition addMutableTrackWithMediaType:AVMediaTypeVideo preferredTrackID:kCMPersistentTrackID_Invalid];
    AVMutableCompositionTrack *a = [composition addMutableTrackWithMediaType:AVMediaTypeAudio preferredTrackID:kCMPersistentTrackID_Invalid];
    if (!v || !a) return 1;
    v.naturalTimeScale = video.naturalTimeScale; a.naturalTimeScale = audio.naturalTimeScale;
    v.preferredTransform = video.preferredTransform;
    // Preserve the exact composition range; never widen to a keyframe.
    if (![v insertTimeRange:range ofTrack:video atTime:kCMTimeZero error:nil] ||
        ![a insertTimeRange:range ofTrack:audio atTime:kCMTimeZero error:nil]) return 1;
    AVAssetExportSession *session = [[AVAssetExportSession alloc] initWithAsset:composition presetName:AVAssetExportPresetPassthrough];
    if (!session) return 1;
    dispatch_semaphore_t compatible = dispatch_semaphore_create(0);
    __block BOOL supported = NO;
    [session determineCompatibleFileTypesWithCompletionHandler:^(NSArray<AVFileType> *types) {
      supported = [types containsObject:AVFileTypeMPEG4]; dispatch_semaphore_signal(compatible);
    }];
    if (!awaitSignal(compatible, deadline) || !supported) return 1;
    session.fileLengthLimit = (int64_t)maxOutputBytes;
    session.outputURL = outputURL; session.outputFileType = AVFileTypeMPEG4;
    session.timeRange = CMTimeRangeMake(kCMTimeZero, range.duration);
    dispatch_semaphore_t finished = dispatch_semaphore_create(0);
    [session exportAsynchronouslyWithCompletionHandler:^{ dispatch_semaphore_signal(finished); }];
    if (!awaitSignal(finished, deadline)) {
      [session cancelExport];
      // Best-effort bounded drain. Main retains ownership until process close.
      dispatch_semaphore_wait(finished, dispatch_time(DISPATCH_TIME_NOW, 2000000000));
      return 1;
    }
    struct stat candidateStat;
    if (session.status != AVAssetExportSessionStatusCompleted || !parentConnected() ||
        lstat(outputURL.fileSystemRepresentation, &candidateStat) || !S_ISREG(candidateStat.st_mode) ||
        candidateStat.st_size <= 0 || candidateStat.st_size > maxOutputBytes) return 1;
    AVURLAsset *output = [AVURLAsset URLAssetWithURL:outputURL options:@{AVURLAssetPreferPreciseDurationAndTimingKey:@YES}];
    if (!load(output, @[@"duration"], deadline) ||
        !CMTIME_IS_NUMERIC(output.duration) ||
        fabs(CMTimeGetSeconds(output.duration) - duration) > 1.0 / 120000) return 1;
    NSDictionary *receipt = @{@"version":@1, @"status":@"completed", @"duration":@(CMTimeGetSeconds(output.duration)), @"audioTrack":@((int)audioIndex)};
    NSData *result = [NSJSONSerialization dataWithJSONObject:receipt options:0 error:nil];
    if (!result || !parentConnected()) return 1;
    [[NSFileHandle fileHandleWithStandardOutput] writeData:result];
    [[NSFileHandle fileHandleWithStandardOutput] writeData:[@"\n" dataUsingEncoding:NSUTF8StringEncoding]];
    return 0;
  }
}
