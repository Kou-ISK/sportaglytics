// @vitest-environment node
import * as fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { renderExportClipGroup } from './exportClipGroup';
import { createPreparedClipRenderer } from './exportPreparedClipRenderer';
import { renderClipWithFfmpeg } from './exportClipRender';
import { concatFiles } from './exportFfmpegRunners';
import type { ExportClipsPayload } from './exportHandlers.types';

vi.mock('./exportClipRender', () => ({ renderClipWithFfmpeg: vi.fn() }));
vi.mock('./exportFfmpegRunners', () => ({ concatFiles: vi.fn() }));
const roots: string[] = [];
afterEach(async () => {
  vi.clearAllMocks();
  await Promise.all(
    roots
      .splice(0)
      .map((root) => fs.rm(root, { recursive: true, force: true })),
  );
});
it.each(['single', 'perRow'] as const)(
  '%s keeps an encoder failure off the final path, with or without native eligibility',
  async (exportMode) => {
    const root = await fs.mkdtemp(
      path.join(os.tmpdir(), 'export-publication-'),
    );
    roots.push(root);
    const outputPath = path.join(root, 'final.mp4');
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
        reason: 'unsupported',
      })),
    ]) {
      for (const existing of [false, true]) {
        if (existing) await fs.writeFile(outputPath, 'existing output');
        const tempFiles: string[] = [];
        const completed = vi.fn();
        await expect(
          renderExportClipGroup({
            clips: [clip],
            outputPath,
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
        ).rejects.toThrow('encoder failed');
        if (existing)
          expect(await fs.readFile(outputPath, 'utf8')).toBe('existing output');
        else
          await expect(fs.stat(outputPath)).rejects.toMatchObject({
            code: 'ENOENT',
          });
        expect(tempFiles).toEqual([path.join(root, 'temporary.mp4')]);
        expect(completed).not.toHaveBeenCalled();
        expect(concatFiles).not.toHaveBeenCalled();
        await fs.rm(outputPath, { force: true });
      }
    }
  },
);
