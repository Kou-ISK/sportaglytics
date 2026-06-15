/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { TimelineData } from '../../../../../../types/timeline/core';
import { useTimelineGlobalShortcuts } from './useTimelineGlobalShortcuts';

const timeline: TimelineData[] = [
  {
    id: 'item-1',
    startTime: 1,
    endTime: 2,
    actionName: 'Scrum',
    labels: [],
    memo: '',
  },
  {
    id: 'item-2',
    startTime: 3,
    endTime: 4,
    actionName: 'Lineout',
    labels: [],
    memo: '',
  },
  {
    id: 'item-3',
    startTime: 5,
    endTime: 6,
    actionName: 'Try',
    labels: [],
    memo: '',
  },
];

describe('useTimelineGlobalShortcuts', () => {
  it('adds selected timeline items to playlist with command shift p', () => {
    const onAddToPlaylist = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);

    renderHook(() =>
      useTimelineGlobalShortcuts({
        selectedIds: ['item-1', 'item-3'],
        timeline,
        scrollContainerRef: {
          current: container,
        } satisfies React.RefObject<HTMLDivElement>,
        onSelectionChange: vi.fn(),
        onSeek: vi.fn(),
        onAddToPlaylist,
      }),
    );

    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'p',
        metaKey: true,
        shiftKey: true,
        bubbles: true,
      }),
    );

    expect(onAddToPlaylist).toHaveBeenCalledWith([timeline[0], timeline[2]]);
  });
});
