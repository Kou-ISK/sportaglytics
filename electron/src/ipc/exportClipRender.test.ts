import * as fs from 'node:fs/promises';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderClipWithFfmpeg } from './exportClipRender';
import { runFfmpegDual, runFfmpegSingle } from './exportFfmpegRunners';

vi.mock('./exportAudioProbe', () => ({
  hasExportAudio: vi.fn(async () => true),
}));

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
    vi.mocked(runFfmpegDual).mockClear();
    tempFiles.length = 0;
  });

  afterEach(async () => {
    await Promise.all(
      tempFiles.map((file) => fs.unlink(file).catch(() => undefined)),
    );
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
    expect(params?.annotationPath).toEqual(
      expect.stringContaining('anno_p_clip-1'),
    );
    expect(params?.annotationPath).toEqual(expect.stringContaining('.png'));
    expect(params?.outputPath).toBe('/out.mp4');
    expect(params?.overlayEnabled).toBe(false);
  });

  it('translates both angle clocks without shifting relative Paint and freeze timing', async () => {
    const base = {
      getFfmpegPath: () => '/ffmpeg',
      clip: {
        id: 'clock',
        actionName: 'Review',
        startTime: 124,
        endTime: 128,
        freezeAt: 2,
        freezeDuration: 1,
      },
      overlay: {
        enabled: false,
        showActionName: false,
        showActionIndex: false,
        showMemo: false,
        showLabels: false,
      },
      mainSource: '/main.mp4',
      secondarySource: '/secondary.mp4',
      useDual: true,
      tempFiles,
      outputPath: '/out.mp4',
      primaryTimeOrigin: 120,
      secondaryTimeOrigin: 122,
    };
    await renderClipWithFfmpeg(base);
    expect(vi.mocked(runFfmpegDual).mock.calls[0]?.[0].clip).toMatchObject({
      startTime: 4,
      endTime: 8,
      secondaryStartTime: 2,
      freezeAt: 2,
      freezeDuration: 1,
    });
    await renderClipWithFfmpeg({
      ...base,
      clip: { ...base.clip, angleType: 'angle2' },
    });
    expect(mockedRunFfmpegSingle.mock.calls[0]?.[0].clip).toMatchObject({
      startTime: 2,
      endTime: 6,
      freezeAt: 2,
      freezeDuration: 1,
    });
  });
});

describe('export text selection', () => {
  it('includes exactly the requested note and honors the index toggle', async () => {
    const { formatOverlayLines } = await import('./exportClipRender');
    const clip = {
      id: 'a',
      actionName: 'Scrum',
      actionIndex: 2,
      startTime: 0,
      endTime: 1,
      memo: 'Edited note\nSecond line',
    };
    const options = {
      enabled: true,
      showActionName: false,
      showActionIndex: false,
      showLabels: false,
      showMemo: true,
    };
    expect(formatOverlayLines(clip, options)).toEqual([
      { text: 'Edited note\nSecond line', isBold: false },
    ]);
    expect(formatOverlayLines(clip, { ...options, showMemo: false })).toEqual(
      [],
    );
    expect(
      formatOverlayLines(clip, {
        ...options,
        showMemo: false,
        showActionName: true,
      }),
    ).toEqual([{ text: 'Scrum', isBold: true }]);
    expect(
      formatOverlayLines(clip, {
        ...options,
        showMemo: false,
        showActionIndex: true,
      }),
    ).toEqual([{ text: '#2', isBold: true }]);
  });
});
