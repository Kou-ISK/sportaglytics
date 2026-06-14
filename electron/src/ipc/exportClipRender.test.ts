import * as fs from 'node:fs/promises';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderClipWithFfmpeg } from './exportClipRender';
import { runFfmpegSingle } from './exportFfmpegRunners';

vi.mock('./exportFfmpegRunners', async () => {
  const actual = await vi.importActual<typeof import('./exportFfmpegRunners')>(
    './exportFfmpegRunners',
  );
  return {
    ...actual,
    runFfmpegSingle: vi.fn(() => Promise.resolve()),
    runFfmpegDual: vi.fn(() => Promise.resolve()),
    concatFiles: vi.fn(() => Promise.resolve()),
  };
});

const mockedRunFfmpegSingle = vi.mocked(runFfmpegSingle);

describe('renderClipWithFfmpeg', () => {
  const tempFiles: string[] = [];

  beforeEach(() => {
    mockedRunFfmpegSingle.mockClear();
    tempFiles.length = 0;
  });

  afterEach(async () => {
    await Promise.all(tempFiles.map((file) => fs.unlink(file).catch(() => undefined)));
    tempFiles.length = 0;
  });

  it('passes rendered playlist annotations to single-angle exports', async () => {
    const result = await renderClipWithFfmpeg({
      getFfmpegPath: () => '/ffmpeg',
      clip: {
        id: 'clip-1',
        actionName: 'Lineout',
        startTime: 10,
        endTime: 14,
        annotationPngPrimary: 'data:image/png;base64,aGVsbG8=',
      },
      overlay: {
        enabled: false,
        showActionName: false,
        showActionIndex: false,
        showLabels: false,
        showMemo: false,
      },
      mainSource: '/main.mp4',
      secondarySource: null,
      useDual: false,
      tempFiles,
      outputPath: '/out.mp4',
    });

    const params = mockedRunFfmpegSingle.mock.calls[0]?.[0];
    expect(result).toBe('/out.mp4');
    expect(params?.annotationPath).toEqual(expect.stringContaining('anno_p_clip-1'));
    expect(params?.annotationPath).toEqual(expect.stringContaining('.png'));
    expect(params?.outputPath).toBe('/out.mp4');
    expect(params?.overlayEnabled).toBe(false);
  });
});
