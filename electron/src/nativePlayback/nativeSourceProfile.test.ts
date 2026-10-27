import { nativeHostConfiguration } from './nativeHostConfiguration';
import { describe, expect, it } from 'vitest';
import { parseNativeSourceProfile } from './nativeSourceProfile';
import {
  parseNativePlaybackPresentation,
  nativePresentationSupports,
} from '../../../src/types/ipc/nativePlaybackPresentation';

export const profileFixture = (): { streams: Record<string, unknown>[] } => ({
  streams: [
    {
      index: 0,
      id: '0x1',
      codec_type: 'video',
      codec_name: 'h264',
      width: 1920,
      height: 1080,
      pix_fmt: 'yuv420p',
      sample_aspect_ratio: '1:1',
      color_range: 'tv',
      color_space: 'bt709',
      color_transfer: 'bt709',
      color_primaries: 'bt709',
      avg_frame_rate: '60000/1001',
      r_frame_rate: '60000/1001',
      time_base: '1/60000',
      start_pts: 0,
      duration_ts: 60060000,
    },
    ...[1, 2, 3].map((index) => ({
      index,
      id: `0x${index + 1}`,
      codec_type: 'audio',
      codec_name: 'aac',
      sample_rate: '48000',
      channels: 2,
      channel_layout: 'stereo',
      time_base: '1/48000',
      start_pts: 0,
      duration_ts: 48047900,
    })),
  ],
});
describe('source profile boundaries', () => {
  it('permits unmuted output only in the explicit Main-owned local trial', () => {
    const muted = parseNativeSourceProfile(profileFixture());
    const trial = parseNativeSourceProfile(profileFixture(), true);
    const intent = {
      targetTime: 1.123,
      rate: 1,
      audioTrack: 0,
      volume: 0,
      muted: false,
    };
    expect(muted.presentation.mutedOnly).toBe(true);
    expect(trial).toEqual({
      ...muted,
      presentation: { ...muted.presentation, mutedOnly: false },
    });
    expect(nativePresentationSupports(muted.presentation, intent, 0)).toBe(
      false,
    );
    expect(nativePresentationSupports(trial.presentation, intent, 0)).toBe(
      true,
    );
    expect(
      nativePresentationSupports(trial.presentation, { ...intent, rate: 2 }, 0),
    ).toBe(false);
    expect(
      nativePresentationSupports(
        trial.presentation,
        { ...intent, audioTrack: 2 },
        0,
      ),
    ).toBe(false);
    const invalid = profileFixture();
    invalid.streams[0].time_base = '1/90000';
    expect(() => parseNativeSourceProfile(invalid, true)).toThrow();
  });
  it('derives all source positions and a safe shorter-audio tail fallback', () => {
    const p = parseNativeSourceProfile(profileFixture());
    const host = nativeHostConfiguration('/synthetic/source.mp4', p);
    expect(host.version).toBe(1);
    expect(host.rollingPCM).toBe(true);
    expect(host.containingField).toBe(true);
    expect(host.handoffTime).toBe(p.presentation.playEnd);
    expect(host.pcmTracks).toEqual([
      { trackID: 2 },
      { trackID: 3 },
      { trackID: 4 },
    ]);
    expect(parseNativePlaybackPresentation(p.presentation)).toEqual(
      p.presentation,
    );
    for (const targetTime of [
      0,
      1001 / 120000,
      (60000 * 1001) / 120000,
      p.presentation.seekEnd,
    ])
      expect(
        nativePresentationSupports(
          p.presentation,
          { targetTime, rate: 1, audioTrack: 2, volume: 1, muted: true },
          2,
        ),
      ).toBe(true);
    expect(p.presentation.playEnd * 120000 + 24 * 1001).toBeLessThanOrEqual(
      (p.pcmEnd * 5) / 2,
    );
    expect(
      nativePresentationSupports(
        p.presentation,
        {
          targetTime: p.presentation.end,
          rate: 1,
          audioTrack: 0,
          volume: 1,
          muted: true,
        },
        0,
      ),
    ).toBe(false);
  });
  it.each(['duration_ts', 'start_pts', 'avg_frame_rate', 'color_space'])(
    'rejects unsupported video %s',
    (key) => {
      const raw = profileFixture();
      raw.streams[0][key] =
        key === 'duration_ts'
          ? Number.MAX_SAFE_INTEGER
          : key === 'start_pts'
            ? 1
            : 'unknown';
      expect(() => parseNativeSourceProfile(raw)).toThrow();
    },
  );
  it.each(['duration_ts', 'start_pts', 'channels', 'id'])(
    'rejects a changed third audio %s',
    (key) => {
      const raw = profileFixture();
      raw.streams[3][key] = key === 'id' ? '0x9' : 17;
      expect(() => parseNativeSourceProfile(raw)).toThrow();
    },
  );
  it('rejects extra tracks, short source and non-field terminal time', () => {
    const raw = profileFixture();
    raw.streams.push({ ...raw.streams[3] });
    expect(() => parseNativeSourceProfile(raw)).toThrow();
    raw.streams.pop();
    raw.streams[0].duration_ts = 1001;
    expect(() => parseNativeSourceProfile(raw)).toThrow();
    raw.streams[0].duration_ts = 60060001;
    expect(() => parseNativeSourceProfile(raw)).toThrow();
  });
});

it('accepts original pointer clocks that round-trip with another bounded timescale', () => {
  const { presentation } = parseNativeSourceProfile(profileFixture());
  const scope = { ...presentation, end: 9019, playEnd: 9018, seekEnd: 9017 };
  for (const targetTime of [2709.002386456509, 1.123000000123, 2.500001 + 10])
    expect(
      nativePresentationSupports(
        scope,
        { targetTime, rate: 1, audioTrack: 0, volume: 0, muted: true },
        0,
      ),
    ).toBe(true);
});

it('accepts representable original clocks without snapping to fields', () => {
  const { presentation } = parseNativeSourceProfile(profileFixture());
  const supports = (targetTime: number, scope = presentation): boolean =>
    nativePresentationSupports(
      scope,
      { targetTime, rate: 1, audioTrack: 0, volume: 1, muted: true },
      0,
    );
  for (const time of [
    0.008341666, 0.008341667, 1.123, 1.123001, 2.500000001, 999.992316,
  ]) {
    expect(supports(time)).toBe(true);
    expect(
      supports(time, {
        ...presentation,
        seekGrid: { origin: 0, duration: 1001, timescale: 120000 },
      }),
    ).toBe(false);
  }
  expect(supports(1.123000000123)).toBe(true);
  expect(supports(1e-20)).toBe(false);
  expect(supports(-1)).toBe(false);
  expect(supports(presentation.seekEnd + 0.000001)).toBe(false);
  expect(() =>
    parseNativePlaybackPresentation({
      ...presentation,
      seekGrid: { ...presentation.seekGrid, selection: 'nearest' },
    }),
  ).toThrow();
});
