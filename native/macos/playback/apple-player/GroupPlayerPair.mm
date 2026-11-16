#import "GroupPlayerPair.hpp"

@implementation STGroupPlayerPair {
  NSArray<STGroupPlayerSource *> *_sources;
  std::array<appleplayback::GroupClipPlacement, 2> _placements;
  uint64_t _operation, _publishedOperation, _target;
  std::optional<std::array<uint64_t, 2>> _publishedSamples;
  BOOL _closed, _failed;
}
- (instancetype)initWithURLs:(NSArray<NSURL *> *)urls
                 placements:(std::array<appleplayback::GroupClipPlacement, 2>)placements
                     budget:(appleplayback::FrameBudget)budget {
  NSParameterAssert(NSThread.isMainThread && urls.count == 2);
  for (const auto &p : placements)
    NSParameterAssert(p.sourceIndex < groupsurfacewire::MaximumSources && p.sourceEpoch &&
      p.sourceEpoch <= groupsurfacewire::MaximumSequence);
  if ((self = [super init])) {
    _placements = placements;
    NSMutableArray<STGroupPlayerSource *> *sources = [NSMutableArray array];
    for (size_t angle = 0; angle < 2; ++angle) {
      auto p = placements[angle];
      [sources addObject:[[STGroupPlayerSource alloc] initWithURL:urls[angle]
        globalStart:p.globalStart globalEnd:p.globalEnd sourceOffset:p.sourceOffset budget:budget sourceRevision:p.revision]];
    }
    _sources = [sources copy];
  }
  return self;
}
- (BOOL)seek:(uint64_t)ticks operation:(uint64_t)operation {
  NSParameterAssert(NSThread.isMainThread);
  if (_closed || _failed || operation <= _operation || operation > groupsurfacewire::MaximumSequence) return NO;
  // Validate both placements first; do not seek one member on invalid input.
  for (const auto &p : _placements) if (ticks < p.globalStart || ticks >= p.globalEnd) return NO;
  [self pause]; _operation = operation; _target = ticks;
  for (STGroupPlayerSource *source in _sources)
    if (![source seek:ticks operation:operation]) { _failed = YES; [self pause]; return NO; }
  return YES;
}
- (BOOL)adoptOperation:(uint64_t)operation {
  NSParameterAssert(NSThread.isMainThread);
  if (_closed || _failed || !_operation || operation <= _operation || operation > groupsurfacewire::MaximumSequence) return NO;
  for (STGroupPlayerSource *source in _sources)
    if (![source adoptOperation:operation]) { _failed = YES; [self pause]; return NO; }
  _operation = operation; return YES;
}
- (void)poll { [self pollAtGlobalTime:_target]; }
- (void)pollAtGlobalTime:(uint64_t)ticks {
  NSParameterAssert(NSThread.isMainThread);
  if (_closed || _failed) return;
  for (STGroupPlayerSource *source in _sources) {
    [source pollAtGlobalTime:ticks];
    if (source.failed) { _failed = YES; [self pause]; return; }
  }
}
- (std::optional<uint64_t>)availableAnchor:(uint64_t)desired {
  NSParameterAssert(NSThread.isMainThread);
  if (_closed || _failed) return std::nullopt;
  auto a = [_sources[0] frame], b = [_sources[1] frame];
  if (!a || !b) return std::nullopt;
  const uint64_t start = std::max(a->globalStart, b->globalStart), end = std::min(a->globalEnd, b->globalEnd);
  if (start >= end) return std::nullopt;
  return std::min(std::max(desired, start), end - 1);
}
- (BOOL)publish:(appleplayback::GroupPairOwner)owner sender:(GroupSurfaceSender &)sender {
  NSParameterAssert(NSThread.isMainThread);
  if (_closed || _failed || !owner.operation || owner.operation != _operation ||
      !owner.seek || !owner.pair || owner.pair > groupsurfacewire::MaximumSequence)
    throw std::runtime_error("group player pair owner");
  std::array<std::optional<appleplayback::GroupSourceFrame>, 2> frames;
  for (size_t angle = 0; angle < 2; ++angle) {
    auto frame = [_sources[angle] frame];
    if (!frame || !frame->covers(owner.globalTicks)) return NO;
    frames[angle] = *frame;
  }
  const std::array<uint64_t, 2> samples{frames[0]->sourceStart, frames[1]->sourceStart};
  if (_publishedOperation == owner.operation && _publishedSamples && *_publishedSamples == samples) return NO;
  std::array<groupsurfacewire::Identity, 2> identities;
  for (size_t angle = 0; angle < 2; ++angle) {
    auto p = _placements[angle]; const auto &f = *frames[angle];
    identities[angle] = {0, owner.operation, owner.seek, owner.pair, angle,
      p.sourceEpoch, p.sourceIndex, f.sourceStart, f.sourceEnd, owner.globalTicks,
      f.globalStart, f.globalEnd, groupsurfacewire::Content::Image};
  }
  const BOOL sent = sender.sendPair({frames[0]->image, frames[1]->image}, identities);
  if (sent) { _publishedOperation = owner.operation; _publishedSamples = samples; }
  return sent;
}
- (BOOL)scheduleRate:(float)rate globalTicks:(uint64_t)ticks hostTime:(CMTime)hostTime {
  NSParameterAssert(NSThread.isMainThread);
  if (_closed || _failed) return NO;
  // Qualify the whole ready barrier before changing either timebase.
  for (STGroupPlayerSource *source in _sources) {
    auto frame = [source frame]; if (!frame || !frame->covers(ticks)) return NO;
  }
  for (STGroupPlayerSource *source in _sources)
    if (![source scheduleRate:rate globalTicks:ticks hostTime:hostTime]) {
      [self pause]; return NO;
    }
  return YES;
}
- (BOOL)selectAudioAngle:(NSUInteger)angle track:(NSUInteger)track volume:(float)volume muted:(BOOL)muted {
  NSParameterAssert(NSThread.isMainThread);
  if (_closed || _failed || angle >= 2) return NO;
  // Silence every member before enabling the selected one; a failure cannot
  // leave duplicate audio. The user's mute value itself is not rewritten.
  for (STGroupPlayerSource *source in _sources) [source silence];
  return [_sources[angle] selectAudioTrack:track volume:volume muted:muted];
}
- (void)pause { for (STGroupPlayerSource *source in _sources) [source pause]; }
- (void)close {
  NSParameterAssert(NSThread.isMainThread);
  if (_closed) return;
  _closed = YES; for (STGroupPlayerSource *source in _sources) [source close];
}
- (BOOL)failed { return _failed; }
- (NSError *)error {
  for (STGroupPlayerSource *source in _sources) if (source.error) return source.error;
  return nil;
}
- (BOOL)drained {
  if (!_closed) return NO;
  for (STGroupPlayerSource *source in _sources) if (!source.drained) return NO;
  return YES;
}
@end
