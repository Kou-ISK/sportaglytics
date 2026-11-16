import { describe, expect, it } from 'vitest';
import {
  nativeGroupHostConfiguration,
  nativeHostConfiguration,
} from './nativeHostConfiguration';
import type { NativePackageSourcePlan } from './nativePackageSourcePlan';

const plan = (): NativePackageSourcePlan => ({
  key: 'synthetic',
  end: 30,
  angleIds: ['second', 'first'],
  sources: [
    {
      angleId: 'first',
      clipId: 'a',
      sourceKey: 'a',
      path: '/fixture/first.mov',
      url: 'file:///fixture/first.mov',
      durationSeconds: 30,
      globalStart: 0,
      globalEnd: 30,
      sourceTimeOffset: 0,
    },
    {
      angleId: 'second',
      clipId: 'b',
      sourceKey: 'b',
      path: '/fixture/second.mov',
      url: 'file:///fixture/second.mov',
      durationSeconds: 30,
      globalStart: -0.5,
      globalEnd: 29.5,
      sourceTimeOffset: 0.5,
    },
  ],
  resolve: () => [],
  assertCurrent: async (): Promise<void> => {},
});
describe('Main placed-pair Host configuration', () => {
  it('preserves the legacy manifest and source plan ordering/offsets without mutating the plan', () => {
    expect(nativeHostConfiguration('/fixture/a.mov')).toEqual({
      version: 1,
      source: '/fixture/a.mov',
    });
    const source = plan(),
      before = JSON.stringify(source);
    expect(nativeGroupHostConfiguration(source, 'second')).toEqual({
      version: 2,
      mode: 'placed-pair-deadline-experiment',
      audioAngle: 0,
      sources: [
        {
          path: '/fixture/second.mov',
          sourceIndex: 1,
          sourceEpoch: 1,
          globalStart: 0,
          globalEnd: 3540000,
          sourceOffset: 60000,
        },
        {
          path: '/fixture/first.mov',
          sourceIndex: 0,
          sourceEpoch: 1,
          globalStart: 0,
          globalEnd: 3600000,
          sourceOffset: 0,
        },
      ],
    });
    expect(JSON.stringify(source)).toBe(before);
  });
  it('requires an explicit selected audio owner without choosing another angle', () => {
    expect(nativeGroupHostConfiguration(plan(), 'first').audioAngle).toBe(1);
    expect(() => nativeGroupHostConfiguration(plan(), 'absent')).toThrow(
      'NATIVE_GROUP_HOST_AUDIO_OWNER',
    );
  });
  it('rejects multi-clip, single-angle, duplicate/absent angle membership and no common clip interval', () => {
    const original = plan();
    for (const invalid of [
      { ...original, sources: [...original.sources, original.sources[0]] },
      { ...original, angleIds: ['first'] },
      { ...original, angleIds: ['first', 'first'] },
      { ...original, angleIds: ['first', 'absent'] },
      {
        ...original,
        sources: original.sources.map((s) =>
          s.angleId === 'first' ? { ...s, globalStart: 29.5 } : s,
        ),
      },
    ])
      expect(() => nativeGroupHostConfiguration(invalid, 'first')).toThrow(
        'NATIVE_GROUP_HOST_PLAN',
      );
  });
  it('rejects unknown, nonfinite, invalid clock mappings and unsafe path representations', () => {
    const original = plan();
    for (const patch of [
      { globalStart: Number.NaN },
      { globalEnd: Number.POSITIVE_INFINITY },
      { globalEnd: 0 },
      { globalEnd: 86401 },
      { sourceTimeOffset: -1 },
      { sourceTimeOffset: 86401 },
      { path: 'relative.mov' },
      { path: '/fixture/\0wrong' },
    ])
      expect(() =>
        nativeGroupHostConfiguration(
          {
            ...original,
            sources: [
              { ...original.sources[0], ...patch },
              original.sources[1],
            ],
          },
          'second',
        ),
      ).toThrow('NATIVE_GROUP_HOST_PLAN');
  });
});
