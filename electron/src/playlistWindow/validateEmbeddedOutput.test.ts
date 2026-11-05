import { expect, it, vi } from 'vitest';
const values = vi.hoisted(() => ({ source: '', output: '' }));
vi.mock('../mediaTools', () => ({ getFfprobePath: () => 'ffprobe' }));
vi.mock('../ipc/mediaProcessRunner', () => ({
  runMediaProcess: async (_path: string, args: string[]) => ({
    stdout: args.at(-1) === 'source' ? values.source : values.output,
  }),
}));
import {
  overlappingEmbeddedAudio,
  validateEmbeddedOutput,
} from './validateEmbeddedOutput';
const source = {
  format: { start_time: '0' },
  streams: [
    { codec_type: 'video' },
    { codec_type: 'audio', start_time: '0', duration: '6' },
  ],
};
const video = {
  codec_type: 'video',
  start_time: '0',
  duration: '3',
  avg_frame_rate: '30/1',
};
const audio = { codec_type: 'audio', start_time: '0', duration: '1' };
it('accepts a shorter valid audio stream without rejecting aligned video', async () => {
  values.source = JSON.stringify(source);
  values.output = JSON.stringify({ streams: [video, audio] });
  await expect(
    validateEmbeddedOutput('source', 'output', 3, false),
  ).resolves.toBeUndefined();
});
it('requires only audio tracks that overlap the requested interval', async () => {
  values.source = JSON.stringify({
    format: { start_time: '0' },
    streams: [
      { codec_type: 'video' },
      { codec_type: 'audio', start_time: '0', duration: '1' },
      { codec_type: 'audio', start_time: '2', duration: '4' },
    ],
  });
  values.output = JSON.stringify({ streams: [video, audio] });
  await expect(
    validateEmbeddedOutput('source', 'output', 3, false, 2),
  ).resolves.toBeUndefined();
  values.output = JSON.stringify({ streams: [video] });
  await expect(
    validateEmbeddedOutput('source', 'output', 3, false, 2),
  ).rejects.toThrow('TRACK_MISMATCH');
  values.source = JSON.stringify({
    format: { start_time: '0' },
    streams: [
      { codec_type: 'video' },
      { codec_type: 'audio', start_time: '0', duration: '1' },
    ],
  });
  await expect(
    validateEmbeddedOutput('source', 'output', 3, false, 2),
  ).resolves.toBeUndefined();
});
it('accounts for the container start and refuses unknown source timing', async () => {
  values.source = JSON.stringify({
    format: { start_time: '5' },
    streams: [
      { codec_type: 'video' },
      { codec_type: 'audio', start_time: '7', duration: '2' },
    ],
  });
  values.output = JSON.stringify({ streams: [video, audio] });
  await expect(
    validateEmbeddedOutput('source', 'output', 3, false, 2),
  ).resolves.toBeUndefined();
  values.source = JSON.stringify({
    streams: [
      { codec_type: 'video' },
      { codec_type: 'audio', start_time: '7', duration: '2' },
    ],
  });
  await expect(
    validateEmbeddedOutput('source', 'output', 3, false, 2),
  ).rejects.toThrow('SOURCE_AUDIO_TIME_UNKNOWN');
});
it('uses half-open boundaries and excludes an empty or nonoverlapping track', async () => {
  values.source = JSON.stringify({
    format: { start_time: '-2' },
    streams: [
      { codec_type: 'video' },
      { codec_type: 'audio', start_time: '-3', duration: '1' },
      { codec_type: 'audio', start_time: '-2', duration: '0' },
      { codec_type: 'audio', start_time: '-2', duration: '1' },
      { codec_type: 'audio', start_time: '1', duration: '2' },
    ],
  });
  await expect(overlappingEmbeddedAudio('source', 0, 3)).resolves.toEqual([2]);
});
it.each(['0.1', '-0.1'])(
  'does not invent overlap at a decimal boundary with format start %s',
  async (formatStart) => {
    values.source = JSON.stringify({
      format: { start_time: formatStart },
      streams: [
        { codec_type: 'video' },
        { codec_type: 'audio', start_time: '0.2', duration: '0.6' },
      ],
    });
    await expect(
      overlappingEmbeddedAudio('source', formatStart === '0.1' ? 0.7 : 0.9, 1),
    ).resolves.toEqual([]);
  },
);
it('rejects late video or missing selected audio before publication', async () => {
  values.source = JSON.stringify(source);
  values.output = JSON.stringify({
    streams: [{ ...video, start_time: '0.9' }, audio],
  });
  await expect(
    validateEmbeddedOutput('source', 'output', 3, false),
  ).rejects.toThrow('TIME_MISMATCH');
  values.output = JSON.stringify({ streams: [video] });
  await expect(
    validateEmbeddedOutput('source', 'output', 3, true),
  ).rejects.toThrow('TRACK_MISMATCH');
});
