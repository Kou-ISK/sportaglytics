import { parseNativeGroupPresentation } from '../../../src/types/ipc/nativeGroupSurface';
import { parseNativePlaybackIntent } from '../../../src/types/ipc/nativePlayback';
import type { NativePlaybackIntent } from '../../../src/types/ipc/nativePlayback';
import type { NativeGroupPresentation } from '../../../src/types/ipc/nativeGroupSurface';

export interface NativeGroupHostIntent extends Omit<
  NativePlaybackIntent,
  'presentationFence'
> {
  stopProof?: {
    operation: number;
    seek: number;
    pair: number;
    globalTicks: number;
    firstID: number;
    secondID: number;
  };
}
/** Main validates its published pair ledger before translating the pointer-free
 * preload receipt. This grants no executable/source-path/clock authority. */
export const nativeGroupHostIntent = (
  raw: unknown,
  validateStop: (
    proof: NativeGroupPresentation,
    intent: NativePlaybackIntent,
  ) => NativeGroupPresentation,
): NativeGroupHostIntent => {
  const intent = parseNativePlaybackIntent(raw);
  const { presentationFence, ...wire } = intent;
  if (!presentationFence) return wire;
  const proof = parseNativeGroupPresentation(
    validateStop(presentationFence, intent),
  );
  if (JSON.stringify(proof) !== JSON.stringify(presentationFence))
    throw Error('NATIVE_GROUP_STOP_FENCE_CHANGED');
  return {
    ...wire,
    stopProof: {
      operation: proof.operation,
      seek: proof.seekId,
      pair: proof.pair,
      globalTicks: proof.globalTicks,
      firstID: proof.ids[0],
      secondID: proof.ids[1],
    },
  };
};
