import { beforeEach, expect, it, vi } from 'vitest';
import { concatFiles } from './exportFfmpegRunners';
import { renderClipWithFfmpeg } from './exportClipRender';
import { createPreparedClipRenderer } from './exportPreparedClipRenderer';
import { renderExportClipGroup } from './exportClipGroup';
import type { ExportClipsPayload } from './exportHandlers.types';
import type { NativeClipExportResult } from '../nativeExport/nativeClipExport';

vi.mock('./exportFfmpegRunners', () => ({ concatFiles: vi.fn() }));
vi.mock('./exportClipRender', () => ({ renderClipWithFfmpeg: vi.fn() }));
vi.mock('node:fs/promises', () => ({ unlink: vi.fn(async () => undefined) }));
beforeEach(() => vi.clearAllMocks());
const clip = { id: 'one', actionName: 'Review', startTime: 2, endTime: 8 };
const payload: ExportClipsPayload = {
  sourcePath: '/original.mp4',
  clips: [clip],
  overlay: {
    enabled: false,
    showActionName: false,
    showActionIndex: false,
    showMemo: false,
    showLabels: false,
  },
};
const progress = () => ({
  getDuration: (item: typeof clip) => item.endTime - item.startTime,
  onRenderStart: vi.fn(),
  onRenderProgress: vi.fn(),
  onRendered: vi.fn(),
  onJoinStart: vi.fn(),
  onJoinProgress: vi.fn(),
  onCompleted: vi.fn(),
});

it.each(['single', 'perRow'] as const)(
  '%s holds the actual final output inside native ownership until publication completes',
  async (exportMode) => {
    let finish: ((result: NativeClipExportResult) => void) | undefined;
    const native = vi.fn(
      () =>
        new Promise<NativeClipExportResult>((resolve) => {
          finish = resolve;
        }),
    );
    const renderClip = createPreparedClipRenderer(
      { ...payload, exportMode },
      new Map(),
      [],
      () => 'ffmpeg',
      native,
    );
    const events = progress();
    const pending = renderExportClipGroup({
      clips: [clip],
      outputPath: '/destination/final.mp4',
      renderClip,
      getFfmpegPath: () => 'ffmpeg',
      ...events,
    });
    expect(native).toHaveBeenCalledWith(
      expect.objectContaining({ outputPath: '/destination/final.mp4' }),
    );
    expect(events.onCompleted).not.toHaveBeenCalled();
    finish?.({ status: 'completed' });
    await pending;
    expect(events.onCompleted).toHaveBeenCalledWith(6);
    expect(concatFiles).not.toHaveBeenCalled();
    expect(renderClipWithFfmpeg).not.toHaveBeenCalled();
  },
);

it('does not publish or join again after native cancellation', async () => {
  const native = vi.fn(async () => {
    throw new Error('cancelled');
  });
  const events = progress();
  await expect(
    renderExportClipGroup({
      clips: [clip],
      outputPath: '/destination/final.mp4',
      renderClip: createPreparedClipRenderer(
        payload,
        new Map(),
        [],
        () => 'ffmpeg',
        native,
      ),
      getFfmpegPath: () => 'ffmpeg',
      ...events,
    }),
  ).rejects.toThrow('cancelled');
  expect(events.onCompleted).not.toHaveBeenCalled();
  expect(concatFiles).not.toHaveBeenCalled();
  expect(renderClipWithFfmpeg).not.toHaveBeenCalled();
});

it('retains the encoder and concat route for multiple clips', async () => {
  const second = { ...clip, id: 'two', startTime: 10, endTime: 13 };
  const native = vi.fn();
  vi.mocked(renderClipWithFfmpeg)
    .mockResolvedValueOnce('/tmp/one.mp4')
    .mockResolvedValueOnce('/tmp/two.mp4');
  const clips = [clip, second];
  const events = progress();
  await renderExportClipGroup({
    clips,
    outputPath: '/destination/final.mp4',
    renderClip: createPreparedClipRenderer(
      { ...payload, clips },
      new Map(),
      [],
      () => 'ffmpeg',
      native,
    ),
    getFfmpegPath: () => 'ffmpeg',
    ...events,
  });
  expect(native).not.toHaveBeenCalled();
  expect(concatFiles).toHaveBeenCalledWith(
    expect.any(Function),
    ['/tmp/one.mp4', '/tmp/two.mp4'],
    '/destination/final.mp4',
    expect.objectContaining({ durationSeconds: 9 }),
  );
  expect(events.onCompleted).toHaveBeenCalledWith(9);
});
