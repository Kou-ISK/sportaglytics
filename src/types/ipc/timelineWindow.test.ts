import { describe, expect, it } from 'vitest';
import {
  isTimelineWindowClockPayload,
  isTimelineWindowCommand,
  isTimelineWindowSyncPayload,
} from './timelineWindow';

describe('timeline window IPC guards', () => {
  it('accepts a valid snapshot and rejects non-finite playback time', () => {
    const snapshot = {
      timeline: [],
      rows: [],
      maxSec: 90,
      currentTime: 12,
      isPlaying: true,
      playbackRate: 1,
      selectedIds: [],
      teamNames: ['Home', 'Away'],
      videoSources: ['/tmp/match.mp4'],
      hotkeys: [{ id: 'play-pause', label: '再生/停止', key: 'Space' }],
      updatedAt: Date.now(),
    };
    expect(isTimelineWindowSyncPayload(snapshot)).toBe(true);
    expect(
      isTimelineWindowSyncPayload({ ...snapshot, currentTime: Number.NaN }),
    ).toBe(false);
  });

  it('rejects malformed commands at the IPC boundary', () => {
    expect(isTimelineWindowCommand({ type: 'seek', time: 10 })).toBe(true);
    expect(isTimelineWindowCommand({ type: 'seek', time: '10' })).toBe(false);
    expect(isTimelineWindowCommand({ type: 'delete-items', ids: [1] })).toBe(
      false,
    );
    expect(
      isTimelineWindowCommand({
        type: 'update-item',
        id: 'instance-1',
        updates: { startTime: '10', unexpected: true },
      }),
    ).toBe(false);
  });

  it('accepts explicit row sort commands and rejects ambiguous variants', () => {
    expect(
      isTimelineWindowCommand({
        type: 'sort-rows',
        spec: { criterion: 'name', direction: 'asc' },
      }),
    ).toBe(true);
    expect(
      isTimelineWindowCommand({
        type: 'sort-rows',
        spec: { criterion: 'instanceCount', direction: 'desc' },
      }),
    ).toBe(true);
    expect(
      isTimelineWindowCommand({
        type: 'sort-rows',
        spec: { criterion: 'color' },
      }),
    ).toBe(true);
    expect(
      isTimelineWindowCommand({
        type: 'sort-rows',
        spec: { criterion: 'color', direction: 'asc' },
      }),
    ).toBe(false);
    expect(
      isTimelineWindowCommand({
        type: 'sort-rows',
        spec: { criterion: 'unknown', direction: 'asc' },
      }),
    ).toBe(false);
  });

  it('accepts only finite lightweight playback clocks', () => {
    expect(
      isTimelineWindowClockPayload({
        currentTime: 12,
        isPlaying: true,
        playbackRate: 2,
        updatedAt: 1,
      }),
    ).toBe(true);
    expect(
      isTimelineWindowClockPayload({
        currentTime: Number.POSITIVE_INFINITY,
        isPlaying: true,
        playbackRate: 2,
        updatedAt: 1,
      }),
    ).toBe(false);
  });
});
