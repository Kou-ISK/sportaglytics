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
it('allows enabled overlay settings only when no text will be drawn', () => {
  const emptyOverlay = { ...payload.overlay, enabled: true };
  expect(
    canAttemptNativeClip({ ...payload, overlay: emptyOverlay }, clip, false),
  ).toBe(true);
  for (const setting of [
    'showActionName',
    'showActionIndex',
    'showLabels',
    'showMemo',
  ] as const) {
    const content = {
      ...clip,
      labels: [{ group: 'G', name: 'L' }],
      memo: 'Note',
    };
    expect(
      canAttemptNativeClip(
        { ...payload, overlay: { ...emptyOverlay, [setting]: true } },
        content,
        false,
      ),
    ).toBe(false);
  }
  expect(
    canAttemptNativeClip(
      {
        ...payload,
        overlay: { ...emptyOverlay, showLabels: true, showMemo: true },
      },
      clip,
      false,
    ),
  ).toBe(true);
});

it('provides bounded non-identifying reasons in deterministic order', async () => {
  const { nativeClipEligibility } = await import('./nativeClipEligibility');
  expect(nativeClipEligibility(payload, clip, false)).toBe('eligible');
  expect(nativeClipEligibility({ ...payload, clips: [clip, clip] }, clip, false)).toBe('multiple-clips');
  expect(nativeClipEligibility(payload, clip, true)).toBe('multiple-angles');
  expect(nativeClipEligibility(payload, { ...clip, chromaKey: {} }, false)).toBe('chroma');
  expect(nativeClipEligibility(payload, { ...clip, annotationPngPrimary: 'private content' }, false)).toBe('annotation');
});
