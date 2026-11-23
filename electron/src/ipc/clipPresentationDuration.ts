import type { ClipExportItem } from './exportHandlers.types';

/** Same effective freeze list used by the single- and dual-angle renderers. */
export const clipPresentationDuration = (clip: ClipExportItem): number => {
  const freeze = clip.freezeFrames?.reduce((sum, frame) => sum + Math.max(0, frame.duration), 0) ??
    (clip.freezeAt == null ? 0 : Math.max(0, clip.freezeDuration ?? 0));
  return clip.endTime - clip.startTime + freeze;
};
