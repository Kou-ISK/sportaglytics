// @vitest-environment node
import { expect, it, vi } from 'vitest';
import {
  isQualifiedNativeClip,
  qualifyNativeClip,
} from './nativeClipQualification';
import {
  runNativeExportProbe,
  NativeExportCancelled,
} from './nativeExportProcess';
vi.mock('../mediaTools', () => ({ getFfprobePath: () => 'probe' }));
vi.mock('./nativeExportProcess', async (original) => ({
  ...(await original<typeof import('./nativeExportProcess')>()),
  runNativeExportProbe: vi.fn(),
}));
const request = {
  sourcePath: 'source.mp4',
  outputPath: 'output.mp4',
  start: 3.123,
  duration: 1.234,
  audioTrack: 0,
};
const video = () => ({
  codec_type: 'video',
  codec_name: 'h264',
  width: 1920,
  height: 1080,
  pix_fmt: 'yuv420p',
  sample_aspect_ratio: '1:1',
  extradata_hash: `SHA256:${'a'.repeat(64)}`,
  time_base: '1/60000',
  start_time: '0',
  duration: '1.234',
});
const audio = () => ({
  codec_type: 'audio',
  codec_name: 'aac',
  sample_rate: '48000',
  channels: 2,
  channel_layout: 'stereo',
  extradata_hash: `SHA256:${'b'.repeat(64)}`,
  time_base: '1/48000',
  start_time: '0',
  duration: '1.234',
});
const media = () => ({
  format: { start_time: '0', duration: '1.234' },
  streams: [video(), audio()],
});
it('admits exact presentation ranges at arbitrary source times without frame scans', () => {
  expect(isQualifiedNativeClip(media(), media(), request)).toBe(true);
});
it.each([
  ['audio shift', { start_time: '0.02' }, 1],
  ['audio tail', { duration: '1.244' }, 1],
  ['video duration', { duration: '1.25' }, 0],
  ['coarse timestamp', { time_base: '1/10' }, 0],
  [
    'new codec configuration',
    { extradata_hash: `SHA256:${'c'.repeat(64)}` },
    0,
  ],
  ['audio layout', { channels: 1 }, 1],
] as const)(
  'rejects %s despite a matching container duration',
  (_name, change, index) => {
    const output = media();
    Object.assign(output.streams[index], change);
    expect(isQualifiedNativeClip(media(), output, request)).toBe(false);
  },
);
it('compares the requested audio track instead of always comparing track zero', () => {
  const source = media();
  source.streams.push({
    ...audio(),
    sample_rate: '44100',
    extradata_hash: `SHA256:${'d'.repeat(64)}`,
  });
  const selected = { ...request, audioTrack: 1 };
  expect(isQualifiedNativeClip(source, media(), selected)).toBe(false);
  const output = media();
  Object.assign(output.streams[1], source.streams[2]);
  expect(isQualifiedNativeClip(source, output, selected)).toBe(true);
});
it('retains the complete transform and rejects unexpected rotation/translation', () => {
  const matrix = {
    side_data_list: [
      {
        side_data_type: 'Display Matrix',
        displaymatrix: '000: 0 -65536 0\n001: 65536 0 0\n002: 0 0 1073741824',
      },
    ],
  };
  const source = media(),
    output = media();
  Object.assign(source.streams[0], matrix);
  expect(isQualifiedNativeClip(source, output, request)).toBe(false);
  Object.assign(output.streams[0], matrix);
  expect(isQualifiedNativeClip(source, output, request)).toBe(true);
});
it('rejects extra output tracks and absent or malformed metadata', () => {
  const output = media();
  output.streams.push(audio());
  expect(isQualifiedNativeClip(media(), output, request)).toBe(false);
  for (const malformed of [null, {}, { streams: [null], format: {} }])
    expect(isQualifiedNativeClip(media(), malformed, request)).toBe(false);
});
it('never starts the output probe after the source probe is cancelled', async () => {
  const controller = new AbortController();
  vi.mocked(runNativeExportProbe).mockImplementationOnce(
    async (_binary, _args, signal) => {
      expect(signal).toBe(controller.signal);
      controller.abort();
      throw new NativeExportCancelled();
    },
  );
  await expect(
    qualifyNativeClip('candidate.mp4', {
      ...request,
      signal: controller.signal,
    }),
  ).rejects.toBeInstanceOf(NativeExportCancelled);
  expect(runNativeExportProbe).toHaveBeenCalledOnce();
});
it('allows one extra audio sample of duration rounding without widening the start or video checks', () => {
  const output = media(); Object.assign(output.streams[1], { duration: String(request.duration - 1.5 / 48000) });
  expect(isQualifiedNativeClip(media(), output, request)).toBe(true);
  Object.assign(output.streams[1], { duration: String(request.duration - 2.01 / 48000) });
  expect(isQualifiedNativeClip(media(), output, request)).toBe(false);
  Object.assign(output.streams[1], { duration: String(request.duration - 1.5 / 48000), start_time: '0.00003' });
  expect(isQualifiedNativeClip(media(), output, request)).toBe(false);
});
it('uses consistent integer duration ticks and rejects contradictory timing metadata', () => {
  const output = media(); Object.assign(output.streams[1], { duration_ts: 59232 });
  expect(isQualifiedNativeClip(media(), output, request)).toBe(true);
  Object.assign(output.streams[1], { duration_ts: 59234 });
  expect(isQualifiedNativeClip(media(), output, request)).toBe(false);
});
it('bounds the audio allowance by sample rate even with coarse timebases', () => {
  const source = media(), output = media();
  Object.assign(source.streams[1], { time_base: '1/1000' });
  Object.assign(output.streams[1], { time_base: '1/1000', duration: String(request.duration + 0.0011) });
  expect(isQualifiedNativeClip(source, output, request)).toBe(false);
  Object.assign(output.streams[1], { sample_rate: 'NaN' });
  expect(isQualifiedNativeClip(source, output, request)).toBe(false);
});
it('accepts the observed long audio rounding within one additional sample', () => {
  const duration = 6585.359229882722; const source = media(), output = media();
  Object.assign(output.format, { duration: '6585.359233' });
  Object.assign(output.streams[0], { duration: '6585.359233', duration_ts: 395121554 });
  Object.assign(output.streams[1], { duration: '6585.359208', duration_ts: 316097242 });
  expect(isQualifiedNativeClip(source, output, { ...request, duration })).toBe(true);
});
it('checks one-sample audio rounding at 44.1 kHz without allowing a start offset', () => {
  const source = media(), output = media();
  Object.assign(source.streams[1], { sample_rate: '44100', time_base: '1/44100' });
  Object.assign(output.streams[1], { sample_rate: '44100', time_base: '1/44100', duration: String(request.duration - 1.9 / 44100) });
  expect(isQualifiedNativeClip(source, output, request)).toBe(true);
  Object.assign(output.streams[1], { duration: String(request.duration - 2.1 / 44100) });
  expect(isQualifiedNativeClip(source, output, request)).toBe(false);
  Object.assign(output.streams[1], { duration: request.duration, start_time: String(1.1 / 44100) });
  expect(isQualifiedNativeClip(source, output, request)).toBe(false);
});
it.each(['0', 'NaN', '384001'])('rejects invalid sample rate %s even if source and output agree', (rate) => {
  const source = media(), output = media();
  Object.assign(source.streams[1], { sample_rate: rate }); Object.assign(output.streams[1], { sample_rate: rate });
  expect(isQualifiedNativeClip(source, output, request)).toBe(false);
});
