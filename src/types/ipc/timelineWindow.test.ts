import { describe, expect, it } from 'vitest';
import {
  isTimelineWindowClockPayload,
  isTimelineWindowCommand,
  isTimelineWindowSyncPayload,
} from './timelineWindow';

describe('timeline window IPC guards', () => {
  it('requires an explicit boolean for export subscription readiness', () => {
    expect(
      isTimelineWindowCommand({ type: 'clip-export-ready', ready: true }),
    ).toBe(true);
    expect(
      isTimelineWindowCommand({ type: 'clip-export-ready', ready: false }),
    ).toBe(true);
    expect(isTimelineWindowCommand({ type: 'clip-export-ready' })).toBe(false);
    expect(
      isTimelineWindowCommand({ type: 'clip-export-ready', ready: 'true' }),
    ).toBe(false);
  });
  it('accepts a valid snapshot and rejects non-finite playback time', () => {
    const snapshot = {
      documentId: '00000000-0000-4000-8000-000000000001:1',
      syncVersion: 1,
      selectionRequestId: null,
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
    for (const seconds of [-10, -1, 0, 1, 10])
      expect(isTimelineWindowCommand({ type: 'seek-relative', seconds })).toBe(
        true,
      );
    for (const seconds of [NaN, Infinity, -Infinity, '10', null, undefined])
      expect(isTimelineWindowCommand({ type: 'seek-relative', seconds })).toBe(
        false,
      );
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

it('validates split and merge commands before routing them to the owner', () => {
  expect(
    isTimelineWindowCommand({ type: 'split-item', id: 'one', time: 2 }),
  ).toBe(true);
  expect(
    isTimelineWindowCommand({ type: 'merge-items', ids: ['one', 'two'] }),
  ).toBe(true);
  for (const time of [NaN, Infinity, -1, '2'])
    expect(
      isTimelineWindowCommand({ type: 'split-item', id: 'one', time }),
    ).toBe(false);
  for (const ids of [[], ['one'], ['one', 'one'], [1, 2], ['', 'two']])
    expect(isTimelineWindowCommand({ type: 'merge-items', ids })).toBe(false);
});

it('requires bounded source versions and explicit document/operation identity for selection and context deletion', () => {
  const documentId = '00000000-0000-4000-8000-000000000001:1';
  const requestId = '00000000-0000-4000-8000-000000000002';
  expect(
    isTimelineWindowCommand({
      type: 'selection-change',
      documentId,
      requestId,
      ids: ['one'],
    }),
  ).toBe(true);
  expect(
    isTimelineWindowCommand({ type: 'delete-items', documentId, ids: ['one'] }),
  ).toBe(true);
  for (const invalid of [
    '',
    'relative/path',
    documentId.replace(':1', ':-1'),
    documentId.replace(':1', ':1.5'),
  ]) {
    expect(
      isTimelineWindowCommand({
        type: 'selection-change',
        documentId: invalid,
        requestId,
        ids: ['one'],
      }),
    ).toBe(false);
    expect(
      isTimelineWindowCommand({
        type: 'delete-items',
        documentId: invalid,
        ids: ['one'],
      }),
    ).toBe(false);
  }
  expect(
    isTimelineWindowCommand({
      type: 'selection-change',
      documentId,
      requestId: 'not-an-id',
      ids: [],
    }),
  ).toBe(false);
  const snapshot = {
    documentId,
    selectionRequestId: null,
    timeline: [],
    rows: [],
    maxSec: 1,
    currentTime: 0,
    isPlaying: false,
    playbackRate: 1,
    selectedIds: [],
    teamNames: [],
    videoSources: [],
    hotkeys: [],
    updatedAt: 0,
  };
  for (const syncVersion of [
    0,
    -1,
    1.5,
    Number.MAX_SAFE_INTEGER + 1,
    Infinity,
    '1',
    undefined,
  ])
    expect(isTimelineWindowSyncPayload({ ...snapshot, syncVersion })).toBe(
      false,
    );
  expect(isTimelineWindowSyncPayload({ ...snapshot, syncVersion: 1 })).toBe(
    true,
  );
});
