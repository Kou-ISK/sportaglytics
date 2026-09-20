import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runFfmpegSingle } from './exportFfmpegRunners';
import { runFfmpegProcess } from './exportFfmpegProcess';
import { H264_ENCODER_ARGS } from '../mediaTools';
import { resolveMediaCopyMode } from './exportStreamCopy';
vi.mock('./exportStreamCopy', () => ({
  resolveMediaCopyMode: vi.fn(async () => 'keyframe-range'),
}));

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
    vi.mocked(resolveMediaCopyMode).mockResolvedValue('keyframe-range');
  });

  it('saves a complete source without changing compressed data or timestamps', async () => {
    vi.mocked(resolveMediaCopyMode).mockResolvedValue('whole-file');
    await runFfmpegSingle({
      getFfmpegPath,
      sourcePath: '/source.mp4',
      clip: { startTime: 0, endTime: 16 },
      outputPath: '/out.mp4',
      overlayEnabled: false,
      overlayLines: [],
      getJapaneseFontPath,
      escapeDrawtext,
    });
    const args = mockedRunFfmpegProcess.mock.calls[0][1];
    expect(args).toEqual(expect.arrayContaining(['-copyts', '-c', 'copy']));
    expect(args).not.toContain('-ss');
    expect(args).not.toContain('-t');
  });

  it('accurately seeks and encodes when a copy would change the requested boundaries', async () => {
    vi.mocked(resolveMediaCopyMode).mockResolvedValue(null);
    await runFfmpegSingle({
      getFfmpegPath,
      sourcePath: '/source.mp4',
      clip: { startTime: 3600.25, endTime: 3602.25 },
      outputPath: '/out.mp4',
      overlayEnabled: false,
      overlayLines: [],
      getJapaneseFontPath,
      escapeDrawtext,
    });
    const args = mockedRunFfmpegProcess.mock.calls[0][1];
    expect(args.indexOf('-ss')).toBeLessThan(args.indexOf('-i'));
    expect(args).toContain('3600.25');
    expect(args).not.toContain('copy');
    expect(args[args.indexOf('-filter_complex') + 1]).toContain(
      'trim=duration=2',
    );
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
      '-n',
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
    expect(args).toEqual(expect.arrayContaining(H264_ENCODER_ARGS));
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
    expect(args).toEqual(expect.arrayContaining(H264_ENCODER_ARGS));
    expect(args).not.toContain('copy');
  });
});

it('keeps Studio overlays on their own frames after inserted pauses', async () => {
  mockedRunFfmpegProcess.mockClear();
  const progress = vi.fn();
  await runFfmpegSingle({
    getFfmpegPath,
    sourcePath: '/source.mp4',
    clip: {
      startTime: 0,
      endTime: 10,
      freezeFrames: [
        { time: 0, duration: 2, primary: '/first.png' },
        { time: 5, duration: 3, primary: '/second.png' },
      ],
    },
    outputPath: '/out.mp4',
    overlayEnabled: false,
    overlayLines: [],
    getJapaneseFontPath,
    escapeDrawtext,
    onProgress: progress,
  });
  const args = mockedRunFfmpegProcess.mock.calls[0][1];
  const filters = args[args.indexOf('-filter_complex') + 1];
  expect(filters).toContain('tpad=start_mode=clone:start_duration=2');
  expect(filters).toContain('trim=end=7');
  expect(filters).toContain('between(t,0,2)');
  expect(filters).toContain('between(t,7,10)');
  expect(args).toContain('/first.png');
  expect(args).toContain('/second.png');
  expect(mockedRunFfmpegProcess.mock.calls[0][2]).toMatchObject({
    durationSeconds: 15,
  });
});
