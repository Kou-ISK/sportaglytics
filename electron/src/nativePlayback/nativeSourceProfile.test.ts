import { nativeHostConfiguration } from './nativeHostConfiguration';
import { describe, expect, it } from 'vitest';
import { parseNativeGroupSourceProfile, parseNativeSourceProfile } from './nativeSourceProfile';
import {
  parseNativePlaybackPresentation,
  nativePresentationSupports,
} from '../../../src/types/ipc/nativePlaybackPresentation';

import { profileFixture } from '../testing/nativeSourceProfileFixture';
describe('source profile boundaries', () => {
  it('limits the 720p layout to untransformed progressive group tracks', () => {
    const raw = profileFixture();
    raw.streams.length = 2;
    const video = raw.streams[0];
    Object.assign(video, { width: 1280, height: 720, field_order: 'progressive',
      r_frame_rate: '30000/1001', avg_frame_rate: '30000/1001', time_base: '1/30000',
      color_transfer: 'iec61966-2-4' });
    expect(() => parseNativeSourceProfile(raw)).toThrow();
    expect(parseNativeGroupSourceProfile(raw, true).presentation.height).toBe(720);
    for (const patch of [
      { field_order: 'tt' }, { tags: { rotate: '90' } },
      // A mirror may report zero rotation. Presence of the matrix is sufficient.
      { side_data_list: [{ side_data_type: 'Display Matrix', rotation: 0 }] },
      { side_data_list: [{ side_data_type: 'Display Matrix', rotation: 90 }] },
      { side_data_list: 'unknown' },
    ]) {
      expect(() => parseNativeGroupSourceProfile({ streams: [{ ...video, ...patch }, raw.streams[1]] }, true)).toThrow();
    }
  });
  it('keeps native audio selection, volume and supported rate commands available', () => {
    const trial = parseNativeSourceProfile(profileFixture());
    const intent = {
      targetTime: 1.123,
      rate: 1,
      audioTrack: 0,
      volume: 0.3,
      muted: false,
    };
    expect(nativePresentationSupports(trial.presentation, intent, 0)).toBe(
      true,
    );
    expect(
      nativePresentationSupports(trial.presentation, { ...intent, rate: 2 }, 0),
    ).toBe(true);
    expect(
      nativePresentationSupports(
        trial.presentation,
        { ...intent, audioTrack: 2 },
        0,
      ),
    ).toBe(true);
    const invalid = profileFixture();
    invalid.streams[0].time_base = '1/90000';
    expect(() => parseNativeSourceProfile(invalid)).toThrow();
  });
  it('derives all source positions and a safe shorter-audio tail fallback', () => {
    const p = parseNativeSourceProfile(profileFixture());
    expect(nativeHostConfiguration('/synthetic/source.mp4')).toEqual({
      version: 1,
      source: '/synthetic/source.mp4',
    });
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
    expect(p.presentation.playEnd).toBeCloseTo(48047900 / 48000, 5);
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
  it('rejects extra tracks and invalid terminal time', () => {
    const raw = profileFixture();
    raw.streams.push({ ...raw.streams[3] });
    expect(() => parseNativeSourceProfile(raw)).toThrow();
    raw.streams.pop();
    raw.streams[0].duration_ts = 0;
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
  expect(supports(1e-20)).toBe(true);
  expect(supports(-1)).toBe(false);
  expect(supports(presentation.seekEnd + 0.000001)).toBe(false);
  expect(() =>
    parseNativePlaybackPresentation({
      ...presentation,
      seekGrid: { ...presentation.seekGrid, selection: 'nearest' },
    }),
  ).toThrow();
});
