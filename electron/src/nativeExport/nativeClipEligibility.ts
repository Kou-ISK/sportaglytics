import { formatOverlayLines } from '../../../src/shared/clipExport/clipExportTextLayout';
import type {
  ClipExportItem,
  ClipExportPayload,
} from '../../../src/shared/clipExport/clipExportTypes';

/** Reasons contain no media paths, names, timing, or user data. */
export type NativeEligibilityReason =
  | 'eligible' | 'multiple-clips' | 'multiple-angles' | 'text'
  | 'annotation' | 'chroma' | 'motion' | 'freeze';

export const nativeClipEligibility = (
  payload: ClipExportPayload,
  clip: ClipExportItem,
  useDual: boolean,
): NativeEligibilityReason => {
  if (payload.exportMode !== 'perInstance' && payload.clips.length !== 1) return 'multiple-clips';
  if (useDual && clip.angleType === undefined) return 'multiple-angles';
  if (formatOverlayLines(clip, payload.overlay).length !== 0) return 'text';
  if (clip.annotationPngPrimary || clip.annotationPngSecondary) return 'annotation';
  if (clip.chromaKey) return 'chroma';
  if (clip.motionOverlays?.length) return 'motion';
  if (clip.freezeFrames?.length || (clip.freezeAt != null && (clip.freezeDuration ?? 0) > 0)) return 'freeze';
  return 'eligible';
};

/** Native intermediates must not enter the legacy concat path before join qualification. */
export const canAttemptNativeClip = (
  payload: ClipExportPayload,
  clip: ClipExportItem,
  useDual: boolean,
): boolean => nativeClipEligibility(payload, clip, useDual) === 'eligible';
