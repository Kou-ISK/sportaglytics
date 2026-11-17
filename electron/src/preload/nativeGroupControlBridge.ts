import {
  parseNativePlaybackIntent,
  parseNativePlaybackOwner,
} from '../../../src/types/ipc/nativePlayback';
import type {
  NativePlaybackIntent,
  NativePlaybackOwner,
} from '../../../src/types/ipc/nativePlayback';
import { parseNativeGroupPresentation } from '../../../src/types/ipc/nativeGroupSurface';
import type { NativeGroupPresentation } from '../../../src/types/ipc/nativeGroupSurface';

interface PairOwner {
  freeze(): NativeGroupPresentation | null;
  expect(generation: string, operation: number, seekId: number): void;
}
interface Fence {
  intent: NativePlaybackIntent;
  proof: NativeGroupPresentation;
}
/** One selected writer and one latest stop barrier: never an unbounded queue.
 * Only successful Main open grants an owner; Renderer cannot provide receipts. */
export const createNativeGroupControlBridge = (
  accepted: NativePlaybackOwner,
  surface: PairOwner,
): {
  freeze(raw: unknown): void;
  prepare(raw: unknown): NativePlaybackIntent;
} => {
  const owner = parseNativePlaybackOwner(accepted);
  let previous: NativePlaybackIntent | null = null;
  const fences = new Map<number, Fence>();
  let frozenFrom: number | null = null;
  const read = (raw: unknown): NativePlaybackIntent => {
    const next = parseNativePlaybackIntent(raw);
    if (
      next.generation !== owner.generation ||
      next.sourceKey !== owner.sourceKey
    )
      throw Error('NATIVE_GROUP_CONTROL_OWNER');
    if (previous && next.sequence <= previous.sequence)
      throw Error('NATIVE_GROUP_CONTROL_ORDER');
    if (next.presentationFence)
      throw Error('NATIVE_GROUP_FENCE_IS_PRELOAD_OWNED');
    return next;
  };
  const freeze = (raw: unknown): void => {
    const next = read(raw);
    if (next.playing || [...fences.keys()].some((key) => key >= next.sequence))
      throw Error('NATIVE_GROUP_STOP_ORDER');
    const proof = parseNativeGroupPresentation(surface.freeze());
    parseNativePlaybackIntent({ ...next, presentationFence: proof });
    frozenFrom ??= next.sequence;
    fences.set(next.sequence, { intent: next, proof });
    // Preserve a selected writer that has not entered prepare yet, plus latest.
    const keys = [...fences.keys()];
    for (const key of keys.slice(1, -1)) fences.delete(key);
  };
  return {
    freeze,
    prepare: (raw) => {
      const next = read(raw);
      let fence = fences.get(next.sequence);
      if (!fence && fences.size) {
        if (
          [...fences.values()].every(
            (value) => next.seekId > value.intent.seekId,
          )
        ) {
          fences.clear();
          frozenFrom = null;
        } else if (frozenFrom !== null && next.sequence >= frozenFrom)
          throw Error('NATIVE_GROUP_STOP_FENCE_PENDING');
      }
      if (
        !fence &&
        previous?.playing &&
        !next.playing &&
        previous.seekId === next.seekId
      ) {
        freeze(next);
        fence = fences.get(next.sequence);
      }
      if (fence && JSON.stringify(fence.intent) !== JSON.stringify(next))
        throw Error('NATIVE_GROUP_STOP_INTENT_CHANGED');
      // A later release already froze the canvas: forwarding this older stop
      // must not re-enable paint while that newer stop waits for its writer.
      if (![...fences.keys()].some((key) => key > next.sequence))
        surface.expect(next.generation, next.sequence, next.seekId);
      previous = next;
      for (const key of fences.keys())
        if (key <= next.sequence) fences.delete(key);
      if (!fences.size) frozenFrom = null;
      return fence
        ? parseNativePlaybackIntent({ ...next, presentationFence: fence.proof })
        : next;
    },
  };
};
