/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlaylistItem } from '../../../../types/Playlist';
import type { AnalysisWindowSyncPayload } from '../../../../types/ipc/analysisWindow';
import type { TimelineData } from '../../../../types/TimelineData';
import { useAnalysisWindowController } from './useAnalysisWindowController';

const hookMocks = vi.hoisted(() => ({
  useRawTimelineCsvExport: vi.fn(),
}));

vi.mock('../../analysis/hooks/useRawTimelineCsvExport', () => ({
  useRawTimelineCsvExport: hookMocks.useRawTimelineCsvExport,
}));

const timelineItem: TimelineData = {
  id: 'timeline-1',
  actionName: 'Alpha - Try',
  startTime: 12,
  endTime: 18,
  memo: '',
  labels: [],
};

const playlistItem: PlaylistItem = {
  id: 'playlist-1',
  timelineItemId: 'timeline-1',
  actionName: 'Alpha - Try',
  startTime: 12,
  endTime: 18,
  addedAt: 1,
};

describe('useAnalysisWindowController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('handles sync messages and forwards jump/create actions through the controller', async () => {
    let syncHandler: ((payload: AnalysisWindowSyncPayload) => void) | null =
      null;
    const closeWindow = vi.fn();
    const sendJumpToSegment = vi.fn();
    const sendCreateAiPlaylist = vi.fn();
    const offSync = vi.fn();

    (
      globalThis.window as typeof globalThis.window & {
        electronAPI?: typeof globalThis.window.electronAPI;
      }
    ).electronAPI = {
      analysis: {
        onSync: vi.fn((handler: (payload: AnalysisWindowSyncPayload) => void) => {
          syncHandler = handler;
        }),
        offSync,
        closeWindow,
        sendJumpToSegment,
        sendCreateAiPlaylist,
      },
    } as unknown as typeof globalThis.window.electronAPI;

    const { result, unmount } = renderHook(() => useAnalysisWindowController());

    expect(hookMocks.useRawTimelineCsvExport).toHaveBeenCalledWith({
      timeline: [],
    });

    act(() => {
      syncHandler?.({
        timeline: [timelineItem],
        teamNames: ['Alpha', 'Beta'],
        view: 'matrix',
      });
    });

    expect(result.current.timeline).toEqual([timelineItem]);
    expect(result.current.teamNames).toEqual(['Alpha', 'Beta']);
    expect(result.current.analysisView).toBe('matrix');
    expect(result.current.isSyncing).toBe(false);

    act(() => {
      result.current.handleClose();
      result.current.handleJumpToSegment(timelineItem);
    });
    await act(async () => {
      await result.current.handleCreateAiPlaylist({
        name: 'AI Review',
        items: [playlistItem],
      });
    });

    expect(closeWindow).toHaveBeenCalled();
    expect(sendJumpToSegment).toHaveBeenCalledWith(timelineItem);
    expect(sendCreateAiPlaylist).toHaveBeenCalledWith({
      name: 'AI Review',
      items: [playlistItem],
    });

    unmount();
    expect(offSync).toHaveBeenCalledWith(syncHandler);
  });
});
