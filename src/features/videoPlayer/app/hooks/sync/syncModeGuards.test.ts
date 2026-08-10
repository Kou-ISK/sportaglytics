import { describe, expect, it } from 'vitest';
import type { PackageMediaAngle } from '../../../../../types/package/metadata';
import { usesClipPlacementSync } from './syncModeGuards';

const angle = (
  id: string,
  clips: PackageMediaAngle['clips'],
): PackageMediaAngle => ({
  id,
  name: id,
  sourceKind: 'local',
  clips,
});

describe('usesClipPlacementSync', () => {
  it('allows angle-level sync for direct single-source angles', () => {
    expect(usesClipPlacementSync([angle('a', []), angle('b', [])])).toBe(
      false,
    );
  });

  it('uses clip placement when an angle has multiple clips', () => {
    expect(
      usesClipPlacementSync([
        angle('a', [
          {
            id: 'a1',
            sourceKind: 'local',
            source: '/a1.mp4',
            gapBeforeSeconds: 0,
            timelineStartSeconds: 0,
          },
          {
            id: 'a2',
            sourceKind: 'local',
            source: '/a2.mp4',
            gapBeforeSeconds: 0,
            timelineStartSeconds: 10,
          },
        ]),
        angle('b', []),
      ]),
    ).toBe(true);
  });

  it('uses clip placement when a single clip starts after global zero', () => {
    expect(
      usesClipPlacementSync([
        angle('a', []),
        angle('b', [
          {
            id: 'b1',
            sourceKind: 'local',
            source: '/b1.mp4',
            gapBeforeSeconds: 3,
            timelineStartSeconds: 3,
          },
        ]),
      ]),
    ).toBe(true);
  });
});
