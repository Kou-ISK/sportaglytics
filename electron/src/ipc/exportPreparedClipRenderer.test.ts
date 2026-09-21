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

it('resolves repeated instance ids and reused physical files to their own clocks', async () => {
  const render = createPreparedClipRenderer(
    payload,
    new Map([
      [
        0,
        new Map([
          [payload.sourcePath, { sourcePath: 'same.mp4', timeOrigin: 0 }],
        ]),
      ],
      [
        1,
        new Map([
          [payload.sourcePath, { sourcePath: 'same.mp4', timeOrigin: 120 }],
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
          [request.sourcePath, { sourcePath: 'first.mp4', timeOrigin: -10 }],
          [request.sourcePath2, { sourcePath: 'second.mp4', timeOrigin: -2 }],
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
