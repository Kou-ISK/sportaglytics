import { expect, it } from 'vitest';
import {
  parseNativePlaybackGroupBinding,
  parseNativePlaybackGroupSelection,
} from './nativePlaybackGroup';
import { parseNativePlaybackAvailability } from './nativePlayback';
const binding = () => ({
  audioAngleId: 'second',
  angles: [
    {
      angleId: 'first',
      clipId: 'first-clip',
      sourceUrl: 'file:///synthetic.mp4',
      sourceTimeOffset: 0,
      globalStart: 0,
      globalEnd: 10,
      sourceEnd: 10,
      audioTracks: 3,
    },
    {
      angleId: 'second',
      clipId: 'second-clip',
      sourceUrl: 'file:///synthetic.mp4',
      sourceTimeOffset: 1,
      globalStart: 0,
      globalEnd: 9,
      sourceEnd: 10,
      audioTracks: 3,
    },
  ],
});
it('preserves selected slots with an explicit audio owner, even when URLs are equal', () => {
  expect(
    parseNativePlaybackGroupSelection({
      angleIds: ['second', 'first'],
      audioAngleId: 'first',
    }),
  ).toEqual({ angleIds: ['second', 'first'], audioAngleId: 'first' });
  expect(
    parseNativePlaybackGroupBinding(binding()).angles.map(
      (angle) => angle.angleId,
    ),
  ).toEqual(['first', 'second']);
});
it('rejects paths, extra members, duplicate/missing IDs and a foreign audio owner', () => {
  for (const value of [
    null,
    {},
    { angleIds: ['first'], audioAngleId: 'first' },
    { angleIds: ['first', 'first'], audioAngleId: 'first' },
    { angleIds: ['first', 'second'], audioAngleId: 'other' },
    {
      angleIds: ['first', 'second'],
      audioAngleId: 'first',
      source: '/synthetic.mp4',
    },
  ])
    expect(() => parseNativePlaybackGroupSelection(value)).toThrow();
});
it('validates file binding, exact 120000-tick placement, source endpoints and overlap', () => {
  const change = (
    value: Partial<ReturnType<typeof binding>['angles'][number]>,
  ): unknown => {
    const raw = binding();
    raw.angles[1] = { ...raw.angles[1], ...value };
    return raw;
  };
  for (const value of [
    change({ sourceUrl: 'https://example.test/video' }),
    change({ globalEnd: 10 }),
    change({ sourceTimeOffset: -1 }),
    change({ sourceTimeOffset: 1 / 7 }),
    change({ globalStart: 9 }),
    change({ angleId: 'first' }),
    { ...binding(), audioAngleId: 'other' },
  ])
    expect(() => parseNativePlaybackGroupBinding(value)).toThrow();
});
it('admits group metadata only inside the qualified drawn-pair presentation/audio scope', () => {
  const raw = {
    available: true,
    owner: { generation: 'group', sourceKey: 'a'.repeat(64) },
    sourceUrl: 'file:///native-group/opaque',
    sourceEnd: 10,
    reason: null,
    clockAuthority: 'drawn-pair',
    group: binding(),
    presentation: {
      width: 1920,
      height: 1080,
      start: 0,
      end: 9,
      seekEnd: 8.9,
      playEnd: 8.99,
      rates: [1, -2],
      audioTracks: 3,
      seekGrid: null,
      mutedOnly: false,
      exactFloatVolume: false,
      audioSwitch: true,
    },
  };
  expect(parseNativePlaybackAvailability(raw).group).toEqual(binding());
  expect(() =>
    parseNativePlaybackAvailability({ ...raw, clockAuthority: undefined }),
  ).toThrow();
  expect(() =>
    parseNativePlaybackAvailability({
      ...raw,
      presentation: { ...raw.presentation, end: 10 },
    }),
  ).toThrow();
  expect(() =>
    parseNativePlaybackAvailability({
      ...raw,
      presentation: { ...raw.presentation, audioTracks: 2 },
    }),
  ).toThrow();
});
