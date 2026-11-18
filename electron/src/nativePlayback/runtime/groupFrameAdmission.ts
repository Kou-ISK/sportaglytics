import {
  nativeGroupBlankSource,
  nativeGroupTimescale,
  parseNativeGroupFrameIdentity,
} from '../../../../src/types/ipc/nativeGroupSurface';
import type { NativeGroupFrameIdentity } from '../../../../src/types/ipc/nativeGroupSurface';
import {
  parseNativePlaybackIntent,
  parseNativePlaybackOwner,
} from '../../../../src/types/ipc/nativePlayback';
import type {
  NativePlaybackIntent,
  NativePlaybackOwner,
} from '../../../../src/types/ipc/nativePlayback';
import type { NativePackageSourcePlan } from '../nativePackageSourcePlan';

/** Main-owned mapping authority. A native packet does not authorize a path,
 * replace the source plan or turn an old source callback into a current image. */
export class GroupFrameAdmission {
  private intent: NativePlaybackIntent | null = null;
  private previousOperationPair = 0;
  private maximumPair = 0;
  private epochs = new Map<
    number,
    { epoch: number; source: number; pair: number; id: number }
  >();
  private pairs = new Map<
    number,
    { operation: number; seek: number; time: number; mask: number }
  >();
  private readonly owner: NativePlaybackOwner;
  constructor(
    private readonly plan: NativePackageSourcePlan,
    owner: NativePlaybackOwner,
  ) {
    this.owner = Object.freeze(parseNativePlaybackOwner(owner));
    if (
      owner.sourceKey !== plan.key ||
      plan.angleIds.length < 1 ||
      plan.angleIds.length > 2 ||
      plan.sources.length > nativeGroupBlankSource ||
      !Number.isFinite(plan.end) ||
      plan.end > 86400 ||
      Math.round(plan.end * nativeGroupTimescale) < 1
    )
      throw Error('NATIVE_GROUP_PLAN_SCOPE');
  }
  expect(raw: NativePlaybackIntent): void {
    const intent = parseNativePlaybackIntent(raw);
    if (
      intent.generation !== this.owner.generation ||
      intent.sourceKey !== this.owner.sourceKey ||
      (this.intent &&
        (intent.sequence <= this.intent.sequence ||
          intent.seekId < this.intent.seekId))
    )
      throw Error('NATIVE_GROUP_INTENT_OWNER');
    this.intent = intent;
    this.previousOperationPair = this.maximumPair;
    this.pairs.clear();
  }
  accept(raw: unknown): NativeGroupFrameIdentity | null {
    const frame = parseNativeGroupFrameIdentity(raw),
      intent = this.intent;
    if (
      !intent ||
      frame.operation < intent.sequence ||
      frame.seekId < intent.seekId
    )
      return null;
    if (frame.operation !== intent.sequence || frame.seekId !== intent.seekId)
      throw Error('NATIVE_GROUP_FRAME_OPERATION');
    if (frame.pair <= this.previousOperationPair)
      throw Error('NATIVE_GROUP_PAIR_OPERATION');
    const prior = this.epochs.get(frame.angle);
    if (
      prior &&
      (frame.sourceEpoch < prior.epoch ||
        frame.pair < prior.pair ||
        frame.id === prior.id)
    )
      return null;
    if (prior && frame.pair === prior.pair)
      throw Error('NATIVE_GROUP_PAIR_DUPLICATE');
    if (
      prior &&
      frame.sourceEpoch === prior.epoch &&
      frame.sourceIndex !== prior.source
    )
      throw Error('NATIVE_GROUP_SOURCE_EPOCH');
    const time = frame.globalTicks / nativeGroupTimescale;
    if (time >= this.plan.end) throw Error('NATIVE_GROUP_FRAME_ENDPOINT');
    const positions = this.plan.resolve(time);
    if (positions.length !== this.plan.angleIds.length)
      throw Error('NATIVE_GROUP_PLAN_SCOPE');
    const position = positions[frame.angle];
    if (position && position.angleId !== this.plan.angleIds[frame.angle])
      throw Error('NATIVE_GROUP_PLAN_SCOPE');
    const start = position?.globalStart ?? 0,
      end = position?.globalEnd ?? this.plan.end;
    if (
      frame.globalStart <
        Math.max(0, Math.round(start * nativeGroupTimescale)) ||
      frame.globalEnd > Math.round(end * nativeGroupTimescale)
    )
      throw Error('NATIVE_GROUP_FRAME_PLACEMENT');
    if (!position || position.kind === 'blank') {
      if (frame.content !== 'blank') throw Error('NATIVE_GROUP_BLANK_REQUIRED');
    } else {
      const source = this.plan.sources[frame.sourceIndex];
      if (
        frame.content !== 'image' ||
        !source ||
        source.angleId !== position.angleId ||
        source.sourceKey !== position.sourceKey
      )
        throw Error('NATIVE_GROUP_FRAME_SOURCE');
      const sourceTime = Math.round(position.sourceTime * nativeGroupTimescale);
      const mappedStart = Math.round(
        frame.sourcePTS - position.sourceTimeOffset * nativeGroupTimescale,
      );
      const mappedEnd = Math.round(
        frame.sourceEndPTS - position.sourceTimeOffset * nativeGroupTimescale,
      );
      if (
        sourceTime < frame.sourcePTS ||
        sourceTime >= frame.sourceEndPTS ||
        frame.globalStart < mappedStart - 1 ||
        frame.globalEnd > mappedEnd + 1
      )
        throw Error('NATIVE_GROUP_FRAME_TIME_MAPPING');
    }
    const pair = this.pairs.get(frame.pair);
    if (
      pair &&
      (pair.operation !== frame.operation ||
        pair.seek !== frame.seekId ||
        pair.time !== frame.globalTicks ||
        pair.mask & (1 << frame.angle))
    )
      throw Error('NATIVE_GROUP_PAIR_ANCHOR');
    if (!pair && this.pairs.size >= 6) throw Error('NATIVE_GROUP_PAIR_BOUND');
    const mask = (pair?.mask ?? 0) | (1 << frame.angle);
    if (mask === 3) this.pairs.delete(frame.pair);
    else
      this.pairs.set(frame.pair, {
        operation: frame.operation,
        seek: frame.seekId,
        time: frame.globalTicks,
        mask,
      });
    this.epochs.set(frame.angle, {
      epoch: frame.sourceEpoch,
      source: frame.sourceIndex,
      pair: frame.pair,
      id: frame.id,
    });
    this.maximumPair = Math.max(this.maximumPair, frame.pair);
    return frame;
  }
  isCurrent(frame: NativeGroupFrameIdentity): boolean {
    return (
      this.intent !== null &&
      frame.operation === this.intent.sequence &&
      frame.seekId === this.intent.seekId
    );
  }
}
