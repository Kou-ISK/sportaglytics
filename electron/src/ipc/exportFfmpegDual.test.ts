import { afterEach, expect, it, vi } from 'vitest';
import { probeMedia } from './packageMediaCompositionService';
import { runWithOptionalProgress } from './exportFfmpegCommon';
import { runFfmpegDual } from './exportFfmpegDual';

vi.mock('./packageMediaCompositionService', () => ({ probeMedia: vi.fn() }));
vi.mock('./exportFfmpegCommon', () => ({
  runWithOptionalProgress: vi.fn(async () => {}),
}));
afterEach(() => {
  vi.clearAllMocks();
  vi.mocked(probeMedia).mockReset();
  vi.unstubAllGlobals();
});

it.each([
  ['win32', [25, 1], [30, 1], ',fps=30/1'],
  ['win32', [60, 1], [60, 1], ',fps=60/1'],
  ['win32', [60000, 1001], [25, 1], ',fps=60000/1001'],
  ['darwin', [25, 1], [30, 1], ''],
] as const)(
  'keeps usable dual output timing on %s (%j, %j)',
  async (platform, main, secondary, expected) => {
    vi.stubGlobal('process', { ...process, platform });
    for (const [numerator, denominator] of [main, secondary]) {
      vi.mocked(probeMedia).mockResolvedValueOnce({
        durationSeconds: 2,
        width: 160,
        height: 90,
        hasAudio: false,
        frameRate: { numerator, denominator },
      });
    }
    await runFfmpegDual({
      getFfmpegPath: () => '/synthetic-ffmpeg',
      mainSource: '/main.mp4',
      secondarySource: '/secondary.mp4',
      clip: { startTime: 0, endTime: 2, hasAudio: false },
      outputPath: '/output.mp4',
      overlayEnabled: false,
      overlayLines: [],
      getJapaneseFontPath: () => '/font.ttf',
      escapeDrawtext: (text) => text,
    });
    const args = vi.mocked(runWithOptionalProgress).mock.calls[0][1];
    expect(args[args.indexOf('-filter_complex') + 1]).toContain(
      `hstack=inputs=2,setsar=1${expected}[vbase]`,
    );
    expect(probeMedia).toHaveBeenCalledTimes(platform === 'win32' ? 2 : 0);
  },
);
