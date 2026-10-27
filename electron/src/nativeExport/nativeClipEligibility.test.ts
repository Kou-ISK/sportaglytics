import { expect, it } from 'vitest';
import { canAttemptNativeClip } from './nativeClipEligibility';
import type {
  ClipExportItem,
  ClipExportPayload,
} from '../../../src/shared/clipExport/clipExportTypes';
const clip: ClipExportItem = {
  id: 'one',
  actionName: 'Review',
  startTime: 1,
  endTime: 4,
};
const payload: ClipExportPayload = {
  sourcePath: 'source.mp4',
  clips: [clip],
  overlay: {
    enabled: false,
    showActionName: false,
    showActionIndex: false,
    showMemo: false,
    showLabels: false,
  },
};
it('admits one plain final source while excluding intermediate concat', () => {
  expect(canAttemptNativeClip(payload, clip, false)).toBe(true);
  expect(
    canAttemptNativeClip({ ...payload, clips: [clip, clip] }, clip, false),
  ).toBe(false);
  expect(
    canAttemptNativeClip(
      { ...payload, clips: [clip, clip], exportMode: 'perInstance' },
      clip,
      false,
    ),
  ).toBe(true);
  expect(canAttemptNativeClip(payload, clip, true)).toBe(false);
  expect(
    canAttemptNativeClip(payload, { ...clip, angleType: 'angle2' }, true),
  ).toBe(true);
});
it.each<Partial<ClipExportItem>>([
  { annotationPngPrimary: 'data:png' },
  { annotationPngSecondary: 'data:png' },
  { chromaKey: {} },
  { freezeAt: 0, freezeDuration: 1 },
  { freezeFrames: [{ time: 0, duration: 1 }] },
  {
    motionOverlays: [
      {
        start: 0,
        end: 1,
        baseWidth: 100,
        baseHeight: 100,
        target: 'primary',
        png: 'data:png',
        keyframes: [],
      },
    ],
  },
])('keeps visual edits on the encoder path', (edit) =>
  expect(canAttemptNativeClip(payload, { ...clip, ...edit }, false)).toBe(
    false,
  ),
);
it('keeps enabled text overlay on the encoder path', () =>
  expect(
    canAttemptNativeClip(
      { ...payload, overlay: { ...payload.overlay, enabled: true } },
      clip,
      false,
    ),
  ).toBe(false));
