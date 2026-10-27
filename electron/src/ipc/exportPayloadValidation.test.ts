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
