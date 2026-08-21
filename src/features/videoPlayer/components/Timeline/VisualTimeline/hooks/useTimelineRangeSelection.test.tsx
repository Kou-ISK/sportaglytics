/**
 * @vitest-environment jsdom
 */
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { TimelineData } from '../../../../../../types/timeline/core';
import { useTimelineRangeSelection } from './useTimelineRangeSelection';

const timeline: TimelineData[] = [
  {
    id: 'attack-1',
    actionName: 'Attack',
    startTime: 10,
    endTime: 20,
    memo: '',
  },
  {
    id: 'defence-1',
    actionName: 'Defence',
    startTime: 10,
    endTime: 20,
    memo: '',
  },
];

const mouseEvent = (
  clientX: number,
  clientY: number,
  options: Partial<React.MouseEvent> = {},
): React.MouseEvent =>
  ({
    button: 0,
    clientX,
    clientY,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    ...options,
  }) as React.MouseEvent;

describe('useTimelineRangeSelection', () => {
  it('uses the same container coordinates for overlay and hit testing', () => {
    const onSelectionChange = vi.fn();
    const { result } = renderHook(() =>
      useTimelineRangeSelection({
        timeline,
        selectedIds: [],
        getContainerPoint: (clientX, clientY) => ({ x: clientX, y: clientY }),
        getContainerSize: () => ({ width: 1200, height: 100 }),
        getLaneBounds: (actionName) =>
          actionName === 'Attack'
            ? { top: 0, bottom: 30 }
            : { top: 40, bottom: 70 },
        contentXToTime: (contentX) => contentX / 10,
        onSelectionChange,
      }),
    );

    act(() => result.current.handleMouseDown(mouseEvent(210, 5)));
    act(() => result.current.handleMouseMove(mouseEvent(330, 25)));

    expect(result.current.selectionBox).toEqual({
      left: 210,
      top: 5,
      width: 120,
      height: 20,
    });

    act(() => result.current.handleMouseUp(mouseEvent(330, 25)));

    expect(onSelectionChange).toHaveBeenCalledWith(['attack-1']);
  });

  it('remains aligned when the viewport-to-container conversion includes scroll', () => {
    const onSelectionChange = vi.fn();
    const scrollX = 300;
    const scrollY = 80;
    const { result } = renderHook(() =>
      useTimelineRangeSelection({
        timeline,
        selectedIds: [],
        getContainerPoint: (clientX, clientY) => ({
          x: clientX + scrollX,
          y: clientY + scrollY,
        }),
        getContainerSize: () => ({ width: 1600, height: 500 }),
        getLaneBounds: (actionName) =>
          actionName === 'Attack'
            ? { top: 100, bottom: 130 }
            : { top: 140, bottom: 170 },
        contentXToTime: (contentX) => contentX / 10,
        onSelectionChange,
      }),
    );

    // Content x 210..330 maps to timeline 9..21 seconds after the 120px header.
    act(() => result.current.handleMouseDown(mouseEvent(-90, 25)));
    act(() => result.current.handleMouseUp(mouseEvent(30, 45)));

    expect(onSelectionChange).toHaveBeenCalledWith(['attack-1']);
  });

  it('keeps the base selection when a modifier requests additive selection', () => {
    const onSelectionChange = vi.fn();
    const { result } = renderHook(() =>
      useTimelineRangeSelection({
        timeline,
        selectedIds: ['defence-1'],
        getContainerPoint: (clientX, clientY) => ({ x: clientX, y: clientY }),
        getContainerSize: () => ({ width: 1200, height: 100 }),
        getLaneBounds: (actionName) =>
          actionName === 'Attack'
            ? { top: 0, bottom: 30 }
            : { top: 40, bottom: 70 },
        contentXToTime: (contentX) => contentX / 10,
        onSelectionChange,
      }),
    );

    act(() =>
      result.current.handleMouseDown(
        mouseEvent(210, 5, { metaKey: true } as Partial<React.MouseEvent>),
      ),
    );
    act(() => result.current.handleMouseUp(mouseEvent(330, 25)));

    expect(onSelectionChange).toHaveBeenCalledWith(['defence-1', 'attack-1']);
  });
});
