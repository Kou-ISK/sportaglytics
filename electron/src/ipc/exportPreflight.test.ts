import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { ExportClipsPayload } from './exportHandlers.types';
import { preflightClipExport } from './exportPreflight';
import { runFfmpegProcess } from './exportFfmpegProcess';
vi.mock('./exportFfmpegProcess', () => ({
  runFfmpegProcess: vi.fn(),
}));
let directory: string;
let source: string;
let payload: ExportClipsPayload;
beforeEach(async () => {
  directory = await fs.mkdtemp(
    path.join(os.tmpdir(), 'export-preflight-test-'),
  );
  source = path.join(directory, 'video.mp4');
  await fs.writeFile(source, 'synthetic media bytes');
  payload = {
    sourcePath: source,
    mode: 'single',
    clips: [{ id: 'one', actionName: 'Scrum', startTime: 0, endTime: 2 }],
    overlay: {
      enabled: false,
      showActionName: false,
      showActionIndex: false,
      showLabels: false,
      showMemo: false,
    },
  };
  vi.clearAllMocks();
});
afterEach(async () => {
  await fs.rm(directory, { recursive: true, force: true });
});

it('reports missing files across the batch without creating output or encoding', async () => {
  payload.clips.push(
    {
      ...payload.clips[0],
      id: 'two',
      videoSource: path.join(directory, 'missing-a.mp4'),
    },
    {
      ...payload.clips[0],
      id: 'three',
      videoSource: path.join(directory, 'missing-b.mp4'),
    },
  );
  const failure = await preflightClipExport(payload, directory).catch(
    (error: unknown) => error,
  );
  expect(failure).toBeInstanceOf(Error);
  if (!(failure instanceof Error))
    throw new Error('expected a preflight error');
  expect(failure.message).toContain('missing-a.mp4');
  expect(failure.message).toContain('missing-b.mp4');
  expect(failure.message).not.toContain(directory);
  expect(await fs.readdir(directory)).toEqual(['video.mp4']);
  expect(runFfmpegProcess).not.toHaveBeenCalled();
});
it('checks only the angle and clip sources actually used', async () => {
  payload.sourcePath = path.join(directory, 'unused-fallback.mp4');
  payload.clips[0] = {
    ...payload.clips[0],
    videoSource: path.join(directory, 'unused-primary.mp4'),
    videoSource2: source,
    angleType: 'angle2',
  };
  expect(await preflightClipExport(payload, directory)).toEqual([
    { sourcePath: source },
  ]);
  payload.mode = 'dual';
  // A clip explicitly using one angle is still a single-angle export.
  expect(await preflightClipExport(payload, directory)).toEqual([
    { sourcePath: source },
  ]);
  payload.clips[0].angleType = undefined;
  await expect(preflightClipExport(payload, directory)).rejects.toThrow(
    'unused-primary.mp4',
  );
});
it('checks all physical clips in a virtual timeline before composition', async () => {
  const packagePath = path.join(directory, 'sample.stpkg');
  await fs.mkdir(path.join(packagePath, '.metadata'), { recursive: true });
  await fs.copyFile(source, path.join(packagePath, 'first.mp4'));
  await fs.writeFile(
    path.join(packagePath, '.metadata', 'config.json'),
    JSON.stringify({
      angles: [
        {
          sourceKind: 'local',
          relativePath: 'composite.mp4',
          clips: [
            { id: 'a', relativePath: 'first.mp4', timelineStartSeconds: 0 },
            { id: 'b', relativePath: 'missing.mp4', timelineStartSeconds: 10 },
          ],
        },
      ],
    }),
  );
  payload.sourcePath = path.join(packagePath, 'composite.mp4');
  await expect(preflightClipExport(payload, directory)).rejects.toThrow(
    'missing.mp4',
  );
  expect(runFfmpegProcess).not.toHaveBeenCalled();
  await fs.copyFile(source, path.join(packagePath, 'missing.mp4'));
  const plans = await preflightClipExport(payload, directory);
  expect(plans[0].clips).toHaveLength(2);
  expect(runFfmpegProcess).not.toHaveBeenCalled();
});
it('rejects an invalid range, empty media, missing dual source and unwritable destination', async () => {
  payload.clips[0].endTime = 0;
  await expect(preflightClipExport(payload, directory)).rejects.toThrow(
    '開始・終了時刻',
  );
  payload.clips[0].endTime = 2;
  payload.mode = 'dual';
  await expect(preflightClipExport(payload, directory)).rejects.toThrow(
    '第2ソース',
  );
  payload.mode = 'single';
  await fs.writeFile(source, '');
  await expect(preflightClipExport(payload, source)).rejects.toThrow(
    '保存先フォルダ',
  );
  await expect(preflightClipExport(payload, directory)).rejects.toThrow(
    'video.mp4',
  );
});
