/* @vitest-environment jsdom */
import { useRef } from 'react';
import { act, renderHook } from '@testing-library/react';
import { expect, it } from 'vitest';
import type { TimelineData } from '../../../../types/timeline/core';
import { useTimelineHistory } from './useTimelineHistory';
import { useTimelineRangeEditing } from './useTimelineRangeEditing';

it('commits each edit as one undoable transaction and selects the resulting IDs', () => {
  const initial: TimelineData[] = [
    {
      id: 'first',
      actionName: 'Scrum',
      startTime: 1,
      endTime: 9,
      memo: 'note',
    },
  ];
  let selection: string[] = [];
  const { result } = renderHook(() => {
    const history = useTimelineHistory(initial);
    const ref = useRef(history.timeline);
    ref.current = history.timeline;
    const edits = useTimelineRangeEditing(
      ref,
      (value) => {
        const next = typeof value === 'function' ? value(ref.current) : value;
        ref.current = next;
        history.setTimeline(next);
      },
      (ids) => {
        selection = ids;
      },
    );
    return { ...history, ...edits };
  });
  act(() => result.current.splitTimelineItem('first', 4));
  const split = result.current.timeline;
  expect(selection).toEqual(split.map((item) => item.id));
  act(() => result.current.undo());
  expect(result.current.timeline).toEqual(initial);
  expect(result.current.canUndo).toBe(false);
  act(() => result.current.redo());
  expect(result.current.timeline).toEqual(split);
  act(() => result.current.mergeTimelineItems(selection));
  expect(result.current.timeline).toEqual(initial);
  expect(selection).toEqual(['first']);
  act(() => result.current.undo());
  expect(result.current.timeline).toEqual(split);
  act(() => result.current.splitTimelineItem('first', 1));
  expect(result.current.canRedo).toBe(true);
});
