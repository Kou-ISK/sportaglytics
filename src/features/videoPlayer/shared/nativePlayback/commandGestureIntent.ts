import { parseNativePlaybackIntent } from '../../../../types/ipc/nativePlayback';
import { nativePresentationSupports } from '../../../../types/ipc/nativePlaybackPresentation';
import type { NativePlaybackIntent } from '../../../../types/ipc/nativePlayback';
import type { NativePlaybackPresentation } from '../../../../types/ipc/nativePlaybackPresentation';

/** Build one guarded reverse start without changing the confirmed clock. */
export const createCommandGestureIntent = (
  current: NativePlaybackIntent,
  rate: number,
  presentation: NativePlaybackPresentation | null,
): NativePlaybackIntent | null => {
  const next = { ...current, sequence: current.sequence + 1, playing: true, rate: -rate };
  try { parseNativePlaybackIntent(next); } catch { return null; }
  return presentation && !nativePresentationSupports(presentation, next, current.audioTrack) ? null : next;
};
