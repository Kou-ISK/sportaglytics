import { describe, expect, it } from 'vitest';
import type { TimelineWindowSyncPayload } from '../../src/types/ipc/timelineWindow';
import { createTimelineSyncAdmission } from '../../src/shared/timelineSyncAdmission';
const documentId = '00000000-0000-4000-8000-000000000001:1';
const snapshot = (
  syncVersion: number,
  owner = documentId,
): TimelineWindowSyncPayload => ({
  documentId: owner,
  syncVersion,
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
});
describe('authoritative timeline source admission', () => {
  it('rejects duplicate and late source revisions before forwarding', () => {
    const gate = createTimelineSyncAdmission();
    expect(gate.accept(snapshot(2))).toBe(true);
    expect(gate.accept(snapshot(1))).toBe(false);
    expect(gate.accept(snapshot(2))).toBe(false);
    expect(gate.accept(snapshot(3))).toBe(true);
  });
  it('never returns to an older document generation even with a larger claimed version', () => {
    const gate = createTimelineSyncAdmission();
    const replacement = documentId.replace(':1', ':2');
    expect(gate.accept(snapshot(2, replacement))).toBe(true);
    expect(gate.accept(snapshot(3))).toBe(false);
    expect(gate.owns(documentId)).toBe(false);
    expect(gate.owns(replacement)).toBe(true);
  });
  it('keeps package-session admissions independent', () => {
    const a = createTimelineSyncAdmission(),
      b = createTimelineSyncAdmission();
    a.accept(snapshot(10));
    expect(b.owns(documentId)).toBe(false);
    expect(b.accept(snapshot(1))).toBe(true);
    expect(a.accept(snapshot(9))).toBe(false);
  });
});

it('retires a previous owner and rejects its delayed higher generation after a new owner', () => {
  const gate = createTimelineSyncAdmission();
  const next = '00000000-0000-4000-8000-000000000002:0';
  expect(gate.accept(snapshot(10))).toBe(true);
  expect(gate.accept(snapshot(1, next))).toBe(true);
  expect(gate.accept(snapshot(11, documentId.replace(':1', ':2')))).toBe(false);
  expect(gate.owns(next)).toBe(true);
});
