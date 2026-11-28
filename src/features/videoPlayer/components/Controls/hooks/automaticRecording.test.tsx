/* @vitest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { StrictMode, useRef } from 'react';
import type { PropsWithChildren } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useActionButtonInteractions } from './useActionButtonInteractions';
import { useActiveRecordings } from './useActiveRecordings';
import { useAutomaticRecordingCompletion } from './useAutomaticRecordingCompletion';
import { useLabelSelections } from './useLabelSelections';
import { useRecordingCompletion } from './useRecordingCompletion';

const setup = (duration = 120) => {
  const addTimelineData = vi.fn();
  let position: number | null = 20;
  const { result, rerender } = renderHook(
    ({ position: clock }: { position: number | null }) => {
      const recording = useActiveRecordings([]);
      const labels = useLabelSelections();
      const recentActionsRef = useRef<string[]>([]);
      const complete = useRecordingCompletion({
        ...recording,
        ...labels,
        recentActionsRef,
        addTimelineData,
        getCurrentTime: () => position,
        getCodingDuration: () => duration,
      });
      useAutomaticRecordingCompletion(
        clock,
        duration,
        recording.activeRecordingsRef,
        complete,
        recording.activeRecordings,
      );
      const { handleActionClick } = useActionButtonInteractions({
        ...recording,
        ...labels,
        activeMode: 'code',
        canvasScope: 'layout-1',
        effectiveLinks: [],
        getCurrentTime: () => position,
        setWarning: vi.fn(),
        completeRecording: complete,
        recentActionsRef,
        getButtonColorByName: () => undefined,
      });
      return {
        click: (
          mode?: 'single-click',
          extend = false,
          after = 5,
          name = 'Red Scrum',
          id = 'red',
        ) =>
          handleActionClick(
            'Red',
            { action: 'Scrum', types: [], results: [] },
            name,
            undefined,
            id,
            3,
            after,
            mode,
            extend,
          ),
        active: recording.activeRecordings,
        complete,
        label: () =>
          labels.updateLabelSelections({ 'Red Scrum': { Result: 'Won' } }),
      };
    },
    {
      initialProps: { position },
      wrapper: ({ children }: PropsWithChildren) => (
        <StrictMode>{children}</StrictMode>
      ),
    },
  );
  return {
    result,
    addTimelineData,
    move: (next: number | null) => {
      position = next;
      rerender({ position });
    },
  };
};

describe('Code Window one-click intervals', () => {
  it('keeps the interval open for labels, closes at the deadline, and publishes once', () => {
    const { result, move, addTimelineData } = setup();
    act(() => result.current.click('single-click'));
    move(24.9);
    expect(addTimelineData).not.toHaveBeenCalled();
    expect(result.current.active['Red Scrum']).toBeDefined();
    act(() => result.current.label());
    move(26);
    move(29);
    expect(addTimelineData.mock.calls).toEqual([
      [
        'Red Scrum',
        17,
        25,
        '',
        undefined,
        undefined,
        [{ group: 'Result', name: 'Won' }],
        undefined,
      ],
    ]);
    expect(result.current.active).toEqual({});
  });

  it('re-arms only when configured, without changing the original start', () => {
    const { result, move, addTimelineData } = setup();
    act(() => result.current.click('single-click', true));
    move(24);
    act(() => result.current.click('single-click', true));
    move(25);
    expect(addTimelineData).not.toHaveBeenCalled();
    move(29);
    expect(addTimelineData.mock.calls[0]?.slice(0, 3)).toEqual([
      'Red Scrum',
      17,
      29,
    ]);
  });

  it('caps the interval at end of media and does not expire with an unavailable clock', () => {
    const { result, move, addTimelineData } = setup(23);
    act(() => result.current.click('single-click'));
    move(21);
    act(() => result.current.click('single-click'));
    move(null);
    expect(addTimelineData).not.toHaveBeenCalled();
    move(23);
    expect(addTimelineData.mock.calls[0]?.slice(0, 3)).toEqual([
      'Red Scrum',
      17,
      23,
    ]);
  });

  it('keeps two-click legacy stop and stop padding unchanged', () => {
    const { result, move, addTimelineData } = setup();
    act(() => result.current.click());
    move(30);
    expect(addTimelineData).not.toHaveBeenCalled();
    act(() => result.current.click());
    expect(addTimelineData.mock.calls[0]?.slice(0, 3)).toEqual([
      'Red Scrum',
      17,
      35,
    ]);
  });

  it('uses source identity to stop the original recording without touching another button', () => {
    const { result, move, addTimelineData } = setup();
    act(() => result.current.click());
    move(21);
    act(() => result.current.click(undefined, false, 0, 'Red Scrum', 'other'));
    expect(addTimelineData).not.toHaveBeenCalled();
    expect(Object.keys(result.current.active)).toEqual(['Red Scrum']);
    act(() => result.current.click(undefined, false, 0, 'Blue Scrum', 'other'));
    move(22);
    act(() => result.current.click(undefined, false, 0, 'Blue Scrum', 'red'));
    expect(addTimelineData.mock.calls[0]?.slice(0, 3)).toEqual([
      'Red Scrum',
      17,
      27,
    ]);
    expect(Object.keys(result.current.active)).toEqual(['Blue Scrum']);
  });

  it('allows lead-only coding while paused and resolves two stops only once', () => {
    const { result, addTimelineData } = setup();
    act(() => result.current.click('single-click', false, 0));
    expect(addTimelineData.mock.calls[0]?.slice(0, 3)).toEqual([
      'Red Scrum',
      17,
      20,
    ]);
    act(() => result.current.click());
    act(() => {
      result.current.complete('Red Scrum');
      result.current.complete('Red Scrum');
    });
    expect(addTimelineData).toHaveBeenCalledTimes(2);
  });
});
