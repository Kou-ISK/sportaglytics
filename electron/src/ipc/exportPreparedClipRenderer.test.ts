import { beforeEach, expect, it, vi } from 'vitest';
import { createPreparedClipRenderer } from './exportPreparedClipRenderer';
import { renderClipWithFfmpeg } from './exportClipRender';
import type { ExportClipsPayload } from './exportHandlers.types';

vi.mock('./exportClipRender', () => ({
  renderClipWithFfmpeg: vi.fn(async () => 'output.mp4'),
}));
beforeEach(() => vi.clearAllMocks());
const payload: ExportClipsPayload = {
  sourcePath: 'logical-primary.mp4',
  clips: [
    { id: 'repeated-id', actionName: 'Review', startTime: 2, endTime: 8 },
    { id: 'repeated-id', actionName: 'Review', startTime: 122, endTime: 128 },
  ],
  overlay: {
    enabled: true,
    showActionName: true,
    showActionIndex: false,
    showMemo: true,
    showLabels: false,
  },
};

it('does not remux an already composited timeline source through the native optimization', async () => {
  const clip = payload.clips[0];
  const request = {
    ...payload,
    clips: [clip],
    overlay: { ...payload.overlay, enabled: false },
  };
  const native = vi.fn(async () => ({ status: 'completed' as const }));
  const render = createPreparedClipRenderer(
    request,
    new Map([
      [
        0,
        new Map([
          [
            payload.sourcePath,
            { sourcePath: 'prepared.mp4', timeOrigin: 2, kind: 'materialized' },
          ],
        ]),
      ],
    ]),
    [],
    () => 'ffmpeg',
    native,
  );
  await render(clip, 'output.mp4');
  expect(native).not.toHaveBeenCalled();
  expect(renderClipWithFfmpeg).toHaveBeenCalledWith(
    expect.objectContaining({
      mainSource: 'prepared.mp4',
      primaryTimeOrigin: 2,
    }),
  );
});

it('resolves repeated instance ids and reused physical files to their own clocks', async () => {
  const render = createPreparedClipRenderer(
    payload,
    new Map([
      [
        0,
        new Map([
          [
            payload.sourcePath,
            { sourcePath: 'same.mp4', timeOrigin: 0, kind: 'direct' },
          ],
        ]),
      ],
      [
        1,
        new Map([
          [
            payload.sourcePath,
            { sourcePath: 'same.mp4', timeOrigin: 120, kind: 'direct' },
          ],
        ]),
      ],
    ]),
    [],
    () => 'ffmpeg',
  );
  await render(payload.clips[0]);
  await render(payload.clips[1]);
  expect(
    vi.mocked(renderClipWithFfmpeg).mock.calls.map(([request]) => ({
      source: request.mainSource,
      origin: request.primaryTimeOrigin,
      start: request.clip.startTime,
      overlay: request.overlay,
    })),
  ).toEqual([
    { source: 'same.mp4', origin: 0, start: 2, overlay: payload.overlay },
    { source: 'same.mp4', origin: 120, start: 122, overlay: payload.overlay },
  ]);
});

it('keeps different primary and secondary angle clocks', async () => {
  const request = {
    ...payload,
    sourcePath2: 'logical-secondary.mp4',
    mode: 'dual' as const,
  };
  const render = createPreparedClipRenderer(
    request,
    new Map([
      [
        0,
        new Map([
          [
            request.sourcePath,
            { sourcePath: 'first.mp4', timeOrigin: -10, kind: 'direct' },
          ],
          [
            request.sourcePath2,
            { sourcePath: 'second.mp4', timeOrigin: -2, kind: 'direct' },
          ],
        ]),
      ],
    ]),
    [],
    () => 'ffmpeg',
  );
  await render(request.clips[0]);
  expect(renderClipWithFfmpeg).toHaveBeenCalledWith(
    expect.objectContaining({
      mainSource: 'first.mp4',
      secondarySource: 'second.mp4',
      primaryTimeOrigin: -10,
      secondaryTimeOrigin: -2,
    }),
  );
});

it('hands the selected angle its local clock and chosen audio before publishing', async () => {
  const clip = {
    ...payload.clips[0],
    angleType: 'angle2' as const,
    audioTrackIndex: 2,
  };
  const request = {
    ...payload,
    sourcePath2: 'logical-secondary.mp4',
    mode: 'dual' as const,
    clips: [clip],
    overlay: { ...payload.overlay, enabled: false },
  };
  const native = vi.fn(async () => ({ status: 'completed' as const }));
  const render = createPreparedClipRenderer(
    request,
    new Map([
      [
        0,
        new Map([
          [
            'logical-secondary.mp4',
            {
              sourcePath: 'physical-secondary.mp4',
              timeOrigin: -10,
              kind: 'direct',
            },
          ],
        ]),
      ],
    ]),
    [],
    () => 'ffmpeg',
    native,
  );
  expect(await render(clip, 'final.mp4')).toBe('final.mp4');
  expect(native).toHaveBeenCalledWith({
    sourcePath: 'physical-secondary.mp4',
    start: 12,
    duration: 6,
    audioTrack: 2,
    outputPath: 'final.mp4',
  });
  expect(renderClipWithFfmpeg).not.toHaveBeenCalled();
});

it('falls back with the same selected source, clock and audio, but never on fatal rejection', async () => {
  const clip = { ...payload.clips[0], audioTrackIndex: 2 };
  const request = {
    ...payload,
    clips: [clip],
    overlay: { ...payload.overlay, enabled: false },
  };
  const native = vi.fn(async () => ({
    status: 'fallback' as const,
    reason: 'output-unqualified',
  }));
  const render = createPreparedClipRenderer(
    request,
    new Map(),
    [],
    () => 'ffmpeg',
    native,
  );
  await render(clip, 'final.mp4');
  expect(renderClipWithFfmpeg).toHaveBeenCalledWith(
    expect.objectContaining({
      clip: expect.objectContaining({ audioTrackIndex: 2 }),
      outputPath: 'final.mp4',
    }),
  );
  vi.mocked(renderClipWithFfmpeg).mockClear();
  native.mockRejectedValueOnce(Error('source changed'));
  await expect(render(clip, 'other.mp4')).rejects.toThrow('source changed');
  expect(renderClipWithFfmpeg).not.toHaveBeenCalled();
});
