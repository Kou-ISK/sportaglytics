import type {
  ClipExportItem,
  ClipExportPayload,
} from '../../../src/shared/clipExport/clipExportTypes';

/** Native intermediates must not enter the legacy concat path before join qualification. */
export const canAttemptNativeClip = (
  payload: ClipExportPayload,
  clip: ClipExportItem,
  useDual: boolean,
): boolean =>
  (payload.exportMode === 'perInstance' || payload.clips.length === 1) &&
  (!useDual || clip.angleType !== undefined) &&
  !payload.overlay.enabled &&
  !clip.annotationPngPrimary &&
  !clip.annotationPngSecondary &&
  !clip.chromaKey &&
  !clip.motionOverlays?.length &&
  !clip.freezeFrames?.length &&
  !(clip.freezeAt != null && (clip.freezeDuration ?? 0) > 0);
