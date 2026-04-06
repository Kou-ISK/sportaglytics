import { describe, expect, it } from 'vitest';
import type {
  AnalysisAiPlaylistPayload,
  AnalysisWindowSyncPayload,
} from './analysisWindow';
import {
  isAnalysisAiPlaylistPayload,
  isAnalysisWindowSyncPayload,
  isTimelineData,
} from './analysisWindow';

const timelineItem = {
  id: 'timeline-1',
  actionName: 'Try',
  startTime: 10,
  endTime: 15,
  memo: '',
  labels: [{ name: 'Won', group: 'result' }],
};

describe('analysisWindow IPC guards', () => {
  it('accepts valid timeline and sync payloads', () => {
    const syncPayload: AnalysisWindowSyncPayload = {
      timeline: [timelineItem],
      teamNames: ['Alpha', 'Beta'],
      view: 'matrix',
    };

    expect(isTimelineData(timelineItem)).toBe(true);
    expect(isAnalysisWindowSyncPayload(syncPayload)).toBe(true);
  });

  it('rejects invalid AI playlist payloads', () => {
    const validPayload: AnalysisAiPlaylistPayload = {
      name: 'AI Review',
      items: [
        {
          id: 'playlist-1',
          timelineItemId: 'timeline-1',
          actionName: 'Try',
          startTime: 10,
          endTime: 15,
          addedAt: 1,
        },
      ],
    };

    expect(isAnalysisAiPlaylistPayload(validPayload)).toBe(true);
    expect(
      isAnalysisAiPlaylistPayload({
        name: 'AI Review',
        items: [{ id: 'broken-item' }],
      }),
    ).toBe(false);
    expect(
      isAnalysisAiPlaylistPayload({
        name: 123,
        items: [],
      }),
    ).toBe(false);
  });
});
