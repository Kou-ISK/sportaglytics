import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runFfmpegSingle } from './exportFfmpegRunners';
import { runFfmpegProcess } from './exportFfmpegProcess';

vi.mock('./exportFfmpegProcess', () => ({
  concatFfmpegFiles: vi.fn(),
  runFfmpegProcess: vi.fn(() => Promise.resolve()),
}));

const mockedRunFfmpegProcess = vi.mocked(runFfmpegProcess);

const getFfmpegPath = (): string => '/ffmpeg';
const getJapaneseFontPath = (): string => '/font.ttf';
const escapeDrawtext = (text: string): string => text;

describe('runFfmpegSingle', () => {
  beforeEach(() => {
    mockedRunFfmpegProcess.mockClear();
  });

  it('uses stream copy when exporting a plain single-angle clip', async () => {
    await runFfmpegSingle({
      getFfmpegPath,
      sourcePath: '/source.mp4',
      clip: { startTime: 10, endTime: 14 },
      outputPath: '/out.mp4',
      overlayEnabled: false,
      overlayLines: [],
      annotationPath: null,
      getJapaneseFontPath,
      escapeDrawtext,
    });

    expect(mockedRunFfmpegProcess).toHaveBeenCalledWith(getFfmpegPath, [
      '-y',
      '-ss',
      '10',
      '-i',
      '/source.mp4',
      '-t',
      '4',
      '-map',
      '0:v',
      '-map',
      '0:a?',
      '-c',
      'copy',
      '-avoid_negative_ts',
      'make_zero',
      '/out.mp4',
    ]);
  });

  it('keeps re-encoding when an overlay is enabled', async () => {
    await runFfmpegSingle({
      getFfmpegPath,
      sourcePath: '/source.mp4',
      clip: { startTime: 10, endTime: 14 },
      outputPath: '/out.mp4',
      overlayEnabled: true,
      overlayLines: [{ text: '#1 Scrum', isBold: true }],
      annotationPath: null,
      getJapaneseFontPath,
      escapeDrawtext,
    });

    const args = mockedRunFfmpegProcess.mock.calls[0]?.[1] ?? [];
    expect(args).toContain('-filter_complex');
    expect(args).toContain('libx264');
    expect(args).not.toContain('copy');
  });

  it('keeps re-encoding when a freeze frame is present', async () => {
    await runFfmpegSingle({
      getFfmpegPath,
      sourcePath: '/source.mp4',
      clip: { startTime: 10, endTime: 14, freezeAt: 2, freezeDuration: 1 },
      outputPath: '/out.mp4',
      overlayEnabled: false,
      overlayLines: [],
      annotationPath: null,
      getJapaneseFontPath,
      escapeDrawtext,
    });

    const args = mockedRunFfmpegProcess.mock.calls[0]?.[1] ?? [];
    expect(args).toContain('-filter_complex');
    expect(args).toContain('libx264');
    expect(args).not.toContain('copy');
  });
});
