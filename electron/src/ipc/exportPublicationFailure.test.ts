// @vitest-environment node
import * as fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { renderExportClipGroup } from './exportClipGroup';
import {
  createExportResources,
  exportResourceContext,
} from './exportResourceContext';
import { createPreparedClipRenderer } from './exportPreparedClipRenderer';
import { renderClipWithFfmpeg } from './exportClipRender';
import { concatFiles } from './exportFfmpegRunners';
import { publishExportOutput } from './exportOutputTransaction';
import type { ExportClipsPayload } from './exportHandlers.types';

vi.mock('./exportClipRender', () => ({ renderClipWithFfmpeg: vi.fn() }));
vi.mock('./exportFfmpegRunners', () => ({ concatFiles: vi.fn() }));
const roots: string[] = [];
afterEach(async () => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  await Promise.all(
    roots
      .splice(0)
      .map((root) => fs.rm(root, { recursive: true, force: true })),
  );
});
it.each(['success', 'cancel', 'collision'] as const)('Windows direct staging preserves publication on %s', async (mode) => {
  vi.stubGlobal('process', { ...process, platform: 'win32' });
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'export-win-direct-'));
  roots.push(root);
  const outputPath = path.join(root, 'final.mp4');
  if (mode === 'collision') await fs.writeFile(outputPath, 'existing');
  const controller = new AbortController();
  const resources = await createExportResources(root, controller.signal);
  const clip = { id: 'one', actionName: 'Test', startTime: 0, endTime: 2 };
  const payload: ExportClipsPayload = { sourcePath: '/input.mp4', exportMode: 'single', clips: [clip], overlay: { enabled: false, showActionName: false, showActionIndex: false, showLabels: false, showMemo: false } };
  vi.mocked(renderClipWithFfmpeg).mockImplementation(async ({ outputPath: target }) => {
    if (!target) throw new Error('missing staging path');
    await fs.writeFile(target, 'complete', { flag: 'wx' });
    if (mode === 'cancel') controller.abort();
    return target;
  });
  const operation = publishExportOutput(outputPath, (stagingPath) => exportResourceContext.run(resources, () => renderExportClipGroup({
    clips: [clip], outputPath: stagingPath,
    renderClip: createPreparedClipRenderer(payload, new Map(), [], () => 'ffmpeg'),
    getFfmpegPath: () => 'ffmpeg', getDuration: () => 2,
    onRenderStart: vi.fn(), onRenderProgress: vi.fn(), onRendered: vi.fn(), onJoinStart: vi.fn(), onJoinProgress: vi.fn(), onCompleted: vi.fn(),
  })), controller.signal);
  if (mode === 'success') {
    await expect(operation).resolves.toBeUndefined();
    expect(await fs.readFile(outputPath, 'utf8')).toBe('complete');
  } else {
    await expect(operation).rejects.toThrow();
    if (mode === 'collision') expect(await fs.readFile(outputPath, 'utf8')).toBe('existing');
    else await expect(fs.stat(outputPath)).rejects.toMatchObject({ code: 'ENOENT' });
  }
  expect(concatFiles).not.toHaveBeenCalled();
});
it.each([['single', 'darwin'], ['perRow', 'darwin'], ['single', 'win32'], ['perRow', 'win32']] as const)(
  '%s on %s keeps an encoder failure off the final path, with or without native eligibility',
  async (exportMode, platform) => {
    vi.stubGlobal('process', { ...process, platform });
    const root = await fs.mkdtemp(
      path.join(os.tmpdir(), 'export-publication-'),
    );
    roots.push(root);
    const outputPath = path.join(root, 'final.mp4');
    const resources = await createExportResources(
      root,
      new AbortController().signal,
    );
    const clip = { id: 'one', actionName: 'Review', startTime: 1, endTime: 4 };
    const payload: ExportClipsPayload = {
      exportMode,
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
    vi.mocked(renderClipWithFfmpeg).mockImplementation(async (request) => {
      const target = request.outputPath ?? path.join(root, 'temporary.mp4');
      if (!request.outputPath) request.tempFiles.push(target);
      await fs.writeFile(target, 'incomplete encoding');
      throw new Error('encoder failed');
    });
    for (const native of [
      undefined,
      vi.fn(async () => ({
        status: 'fallback' as const,
        reason: 'unsupported-request',
      })),
    ]) {
      for (const existing of [false, true]) {
        vi.mocked(renderClipWithFfmpeg).mockClear();
        native?.mockClear();
        if (existing) await fs.writeFile(outputPath, 'existing output');
        const tempFiles: string[] = [];
        const completed = vi.fn();
        await expect(
          publishExportOutput(outputPath, (stagingPath) => exportResourceContext.run(resources, () =>
            renderExportClipGroup({
              clips: [clip],
              outputPath: stagingPath,
              renderClip: createPreparedClipRenderer(
                payload,
                new Map(),
                tempFiles,
                () => 'ffmpeg',
                native,
              ),
              getFfmpegPath: () => 'ffmpeg',
              getDuration: () => 3,
              onRenderStart: vi.fn(),
              onRenderProgress: vi.fn(),
              onRendered: vi.fn(),
              onJoinStart: vi.fn(),
              onJoinProgress: vi.fn(),
              onCompleted: completed,
            }),
          )),
        ).rejects.toThrow('encoder failed');
        if (native) expect(native).toHaveBeenCalledTimes(1);
        expect(renderClipWithFfmpeg).toHaveBeenCalledTimes(1);
        if (existing)
          expect(await fs.readFile(outputPath, 'utf8')).toBe('existing output');
        else
          await expect(fs.stat(outputPath)).rejects.toMatchObject({
            code: 'ENOENT',
          });
        expect(tempFiles).toEqual(process.platform === 'win32' ? [] : [path.join(root, 'temporary.mp4')]);
        expect(completed).not.toHaveBeenCalled();
        expect(concatFiles).not.toHaveBeenCalled();
        await fs.rm(outputPath, { force: true });
      }
    }
  },
);
