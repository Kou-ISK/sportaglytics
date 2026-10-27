// @vitest-environment node
import { expect, it, vi } from 'vitest';
import { isQualifiedNativeClip } from './nativeClipQualification';
vi.mock('../mediaTools', () => ({ getFfprobePath: () => 'probe' }));
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
