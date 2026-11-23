import { expect, it } from 'vitest';
import { isExportClipsPayload } from './exportPayloadValidation';
const payload = {
  sourcePath: 'source.mp4',
  clips: [{ id: 'clip', actionName: 'Review', startTime: 0, endTime: 3 }],
  overlay: {
    enabled: false,
    showActionName: false,
    showActionIndex: false,
    showLabels: false,
    showMemo: false,
  },
};
it.each([undefined, 0, 2, 63])(
  'accepts a bounded source audio index %s',
  (audioTrackIndex) =>
    expect(
      isExportClipsPayload({
        ...payload,
        clips: [{ ...payload.clips[0], audioTrackIndex }],
      }),
    ).toBe(true),
);
it.each([-1, 64, 1.5, NaN, Infinity, '2', null])(
  'rejects an ambiguous audio index %s',
  (audioTrackIndex) =>
    expect(
      isExportClipsPayload({
        ...payload,
        clips: [{ ...payload.clips[0], audioTrackIndex }],
      }),
    ).toBe(false),
);

it('requires a source for media and bounded frames for source-free exports', () => {
  const sourceFree = { ...payload, sourcePath: '' };
  expect(isExportClipsPayload(sourceFree)).toBe(false);
  for (const frame of ['file:///slide.png', 'data:image/png;base64,AA==', 'https://example.invalid/a.png']) {
    expect(isExportClipsPayload({ ...sourceFree, clips: [{ ...payload.clips[0], slideFrame: frame }] })).toBe(false);
  }
  expect(isExportClipsPayload({ ...payload, exportMode: 'organizerRows' })).toBe(false);
  expect(isExportClipsPayload({ ...payload, exportMode: 'organizerRows', clips: [
    { ...payload.clips[0], organizerRow: { id: 'theme-a', name: 'Theme' } },
  ] })).toBe(true);
});
