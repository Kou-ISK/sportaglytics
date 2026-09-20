import { expect, it } from 'vitest';
import {
  isTimelineWindowCommand,
  isTimelineWindowSyncPayload,
} from './timelineWindow';
it('validates angle sync commands and detached timeline snapshots', () => {
  for (const command of [
    { action: 'select', index: -1 },
    { action: 'step', direction: 2 },
    { action: 'skip', seconds: Infinity },
    { action: 'destroy' },
  ])
    expect(isTimelineWindowCommand({ type: 'angle-sync', command })).toBe(
      false,
    );
  expect(
    isTimelineWindowCommand({
      type: 'angle-sync',
      command: { action: 'select', index: 7 },
    }),
  ).toBe(true);
  const snapshot = {
    timeline: [],
    rows: [],
    maxSec: 30,
    currentTime: 15,
    isPlaying: false,
    playbackRate: 1,
    selectedIds: [],
    teamNames: [],
    videoSources: [],
    hotkeys: [],
    updatedAt: 1,
    angleSync: {
      angles: [{ name: 'Angle 1', point: 26, clips: [{ start: 0, end: 30 }] }],
      selected: 0,
      busy: false,
      saving: false,
      analyzing: false,
      changed: false,
      canMark: true,
      canAlign: false,
      frameAvailable: true,
      message: '',
    },
  };
  expect(isTimelineWindowSyncPayload(snapshot)).toBe(true);
  expect(
    isTimelineWindowSyncPayload({
      ...snapshot,
      angleSync: { ...snapshot.angleSync, selected: 5 },
    }),
  ).toBe(false);
  expect(
    isTimelineWindowSyncPayload({
      ...snapshot,
      angleSync: {
        ...snapshot.angleSync,
        angles: [{ name: 'Invalid', point: NaN, clips: [] }],
      },
    }),
  ).toBe(false);
});
