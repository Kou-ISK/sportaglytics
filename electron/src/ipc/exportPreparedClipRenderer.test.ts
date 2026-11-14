import { beforeEach, expect, it, vi } from 'vitest';
import { createPreparedClipRenderer } from './exportPreparedClipRenderer';
import { renderClipWithFfmpeg } from './exportClipRender';
import { qualifySilentFallback } from './exportFallbackQualification';
import { exportResourceContext } from './exportResourceContext';
import type { ExportClipsPayload } from './exportHandlers.types';

vi.mock('./exportFallbackQualification', () => ({ qualifySilentFallback: vi.fn(async () => undefined) }));
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

it('stops an unbudgeted native fallback and fatal rejection', async () => {
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
  await expect(render(clip, 'final.mp4')).rejects.toMatchObject({ name: 'NativeFallbackBudgetUnavailable' });
  expect(renderClipWithFfmpeg).not.toHaveBeenCalled();
  native.mockRejectedValueOnce(Error('source changed'));
  await expect(render(clip, 'other.mp4')).rejects.toThrow('source changed');
  expect(renderClipWithFfmpeg).not.toHaveBeenCalled();
});

it('uses the native path for an enabled overlay that produces no visible text', async () => {
  const clip = payload.clips[0];
  const emptyOverlay = {
    enabled: true,
    showActionName: false,
    showActionIndex: false,
    showMemo: false,
    showLabels: false,
  };
  const request = { ...payload, clips: [clip], overlay: emptyOverlay };
  const native = vi.fn(async () => ({ status: 'completed' as const }));
  const render = createPreparedClipRenderer(
    request,
    new Map(),
    [],
    () => 'ffmpeg',
    native,
  );
  expect(await render(clip, 'output.mp4')).toBe('output.mp4');
  expect(native).toHaveBeenCalledOnce();
  expect(renderClipWithFfmpeg).not.toHaveBeenCalled();
});

it('retains the encoder path when enabled overlay produces visible text', async () => {
  const clip = payload.clips[0];
  const request = { ...payload, clips: [clip] };
  const native = vi.fn(async () => ({ status: 'completed' as const }));
  const render = createPreparedClipRenderer(
    request,
    new Map(),
    [],
    () => 'ffmpeg',
    native,
  );
  await render(clip, 'output.mp4');
  expect(native).not.toHaveBeenCalled();
  expect(renderClipWithFfmpeg).toHaveBeenCalledOnce();
});

it('reports only a bounded eligibility reason when diagnostic mode is enabled', async () => {
  const previous = process.env.SPORTAGLYTICS_EXPORT_DIAGNOSTICS;
  process.env.SPORTAGLYTICS_EXPORT_DIAGNOSTICS = '1';
  const log = vi.spyOn(console, 'info').mockImplementation(() => {});
  try {
    const render = createPreparedClipRenderer(payload, new Map(), [], () => 'ffmpeg');
    await render(payload.clips[0], 'sensitive-output.mp4');
    expect(log).toHaveBeenCalledWith('[export] Native eligibility', { decision: 'provider-unavailable' });
    expect(JSON.stringify(log.mock.calls)).not.toContain('sensitive-output');
    expect(JSON.stringify(log.mock.calls)).not.toContain(payload.sourcePath);
  } finally {
    log.mockRestore();
    if (previous === undefined) delete process.env.SPORTAGLYTICS_EXPORT_DIAGNOSTICS;
    else process.env.SPORTAGLYTICS_EXPORT_DIAGNOSTICS = previous;
  }
});

it('does not start FFmpeg when a native helper reports an unknown failure', async () => {
  const clip = payload.clips[0];
  const request = { ...payload, clips: [clip], overlay: { ...payload.overlay, enabled: false } };
  const { NativeExportUnknownFailure } = await import('../nativeExport/nativeClipExport');
  const error = new NativeExportUnknownFailure(new Error('cause'));
  const native = vi.fn(async () => { throw error; });
  const render = createPreparedClipRenderer(request, new Map(), [], () => 'ffmpeg', native);
  await expect(render(clip, 'output.mp4')).rejects.toBe(error);
  expect(renderClipWithFfmpeg).not.toHaveBeenCalled();
});

it('does not start FFmpeg when native reports cancellation', async () => {
  const clip = payload.clips[0];
  const request = { ...payload, clips: [clip], overlay: { ...payload.overlay, enabled: false } };
  const { NativeExportCancelled } = await import('../nativeExport/nativeExportProcess');
  const native = vi.fn(async () => { throw new NativeExportCancelled(); });
  const controller = new AbortController();
  const render = createPreparedClipRenderer(request, new Map(), [], () => 'ffmpeg', native, controller.signal);
  await expect(render(clip, 'output.mp4')).rejects.toMatchObject({ name: 'AbortError' });
  expect(renderClipWithFfmpeg).not.toHaveBeenCalled();
  expect(native).toHaveBeenCalledWith(expect.objectContaining({ signal: controller.signal }));
});

it('passes the requested sub-half-second duration to the native exporter', async () => {
  const clip = { ...payload.clips[0], startTime: 2, endTime: 2.2 };
  const request = { ...payload, clips: [clip], overlay: { ...payload.overlay, enabled: false } };
  const native = vi.fn(async () => ({ status: 'completed' as const }));
  const render = createPreparedClipRenderer(request, new Map([[0, new Map([[request.sourcePath, { sourcePath: 'original.mp4', timeOrigin: 0, kind: 'direct' }]])]]), [], () => 'ffmpeg', native);
  await render(clip, 'final.mp4');
  expect(native).toHaveBeenCalledWith(expect.objectContaining({ start: 2, duration: expect.closeTo(0.2, 8) }));
});


it('requires qualification after bounded no-audio fallback and propagates failed admission', async () => {
  const clip = { ...payload.clips[0], startTime: 2, endTime: 2.2 };
  const request = { ...payload, clips: [clip], overlay: { ...payload.overlay, enabled: false } };
  const native = vi.fn(async () => ({ status: 'fallback' as const, reason: 'native-pre-output-unsupported' }));
  const signal = new AbortController().signal;
  const render = createPreparedClipRenderer(request, new Map(), [], () => 'ffmpeg', native, signal);
  const resources = { signal, maxFileBytes: 1000000, minFreeBytes: 1000, check: async () => undefined };
  vi.mocked(qualifySilentFallback).mockRejectedValueOnce(new Error('Fallback video range unavailable'));
  await expect(exportResourceContext.run(resources, () => render(clip, 'final.mp4'))).rejects.toThrow('Fallback video range unavailable');
  expect(renderClipWithFfmpeg).toHaveBeenCalledOnce();
  expect(qualifySilentFallback).toHaveBeenCalledWith('output.mp4', expect.closeTo(0.2, 8), signal);
});

it('does not publish an unqualified no-audio fallback', async () => {
  const fs = await import('node:fs/promises');
  const os = await import('node:os');
  const path = await import('node:path');
  const { publishExportOutput } = await import('./exportOutputTransaction');
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sportag-fallback-admission-'));
  const output = path.join(root, 'output.mp4');
  const clip = { ...payload.clips[0], startTime: 2, endTime: 2.2 };
  const request = { ...payload, clips: [clip], overlay: { ...payload.overlay, enabled: false } };
  const native = vi.fn(async () => ({ status: 'fallback' as const, reason: 'native-pre-output-unsupported' }));
  const signal = new AbortController().signal;
  const render = createPreparedClipRenderer(request, new Map(), [], () => 'ffmpeg', native, signal);
  vi.mocked(renderClipWithFfmpeg).mockImplementationOnce(async (args) => { await fs.writeFile(args.outputPath!, 'nonvideo'); return args.outputPath!; });
  vi.mocked(qualifySilentFallback).mockRejectedValueOnce(new Error('No video frames'));
  const resources = { signal, maxFileBytes: 1000000, minFreeBytes: 1000, check: async () => undefined };
  await expect(exportResourceContext.run(resources, () => publishExportOutput(output, async (stage) => { await render(clip, stage); }, signal))).rejects.toThrow('No video frames');
  await expect(fs.stat(output)).rejects.toMatchObject({ code: 'ENOENT' });
});
