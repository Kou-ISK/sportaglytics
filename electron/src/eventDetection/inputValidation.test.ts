import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EventDetectionClipInput } from '../../../src/types/eventDetection/core';
import { validateEventDetectionClips } from './inputValidation';

const processMocks = vi.hoisted(() => ({
  spawn: vi.fn(),
  tempPath: vi.fn(),
  permissionDenied: false,
}));
vi.mock('child_process', () => ({ spawn: processMocks.spawn }));
vi.mock('electron', () => ({ app: { getPath: processMocks.tempPath } }));
vi.mock('node:fs/promises', async (importOriginal) => {
  const original = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...original,
    access: async (
      ...args: Parameters<typeof original.access>
    ): Promise<void> => {
      if (processMocks.permissionDenied) {
        throw Object.assign(new Error('permission denied'), { code: 'EACCES' });
      }
      return original.access(...args);
    },
  };
});

let directory: string;
const clip = (
  videoPath: string,
  clipId = 'clip-1',
): EventDetectionClipInput => ({
  clipId,
  videoPath,
  timelineStartSeconds: 0,
});

beforeEach(async () => {
  vi.clearAllMocks();
  processMocks.permissionDenied = false;
  directory = await mkdtemp(path.join(tmpdir(), 'event-input-'));
});
afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

describe('event detection source validation', () => {
  it('accepts readable files without decoding or changing their names', async () => {
    const paths = ['前半 #50%.MP4', '後半 %20.mp4'].map((name) =>
      path.join(directory, name),
    );
    await Promise.all(
      paths.map((videoPath) => writeFile(videoPath, 'fixture')),
    );
    await expect(
      validateEventDetectionClips(
        paths.map((videoPath, index) => clip(videoPath, `clip-${index}`)),
      ),
    ).resolves.toBeUndefined();
  });

  it('identifies a missing later clip instead of silently skipping it', async () => {
    const readable = path.join(directory, 'first.mp4');
    const missing = path.join(directory, '後半.mp4');
    await writeFile(readable, 'fixture');
    await expect(
      validateEventDetectionClips([clip(readable), clip(missing, 'second')]),
    ).rejects.toThrow(`対象: ${missing}`);
  });

  it('rejects a directory even when it has a video extension', async () => {
    const videoPath = path.join(directory, 'directory.mp4');
    await mkdir(videoPath);
    await expect(
      validateEventDetectionClips([clip(videoPath)]),
    ).rejects.toThrow('映像ファイルではありません');
  });

  it('reports an unreadable file with permission guidance', async () => {
    const videoPath = path.join(directory, 'protected.mp4');
    await writeFile(videoPath, 'fixture');
    processMocks.permissionDenied = true;
    await expect(
      validateEventDetectionClips([clip(videoPath)]),
    ).rejects.toThrow(
      `解析する映像ファイルを読み取れません。ファイルのアクセス権と保存先ドライブを確認してください。\n対象: ${videoPath}`,
    );
  });

  it('does not create request files or spawn the model when an input is missing', async () => {
    const { runEventDetectionProcess } = await import('./processRunner');
    const missing = path.join(directory, 'missing.mp4');
    await expect(
      runEventDetectionProcess({
        model: {
          info: {
            id: 'model',
            version: '1',
            displayName: 'Test',
            status: 'experimental',
            events: ['scrum'],
            metrics: {},
          },
          modelDirectory: directory,
          runnerPath: path.join(directory, 'runner'),
          runnerSha256: 'unused',
        },
        request: {
          requestId: 'test',
          modelId: 'model',
          modelVersion: '1',
          events: ['scrum'],
          clips: [clip(missing)],
        },
      }),
    ).rejects.toThrow('解析する映像ファイルが見つかりません');
    expect(processMocks.spawn).not.toHaveBeenCalled();
    expect(processMocks.tempPath).not.toHaveBeenCalled();
  });
});
