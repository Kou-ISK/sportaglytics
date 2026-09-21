/* @vitest-environment jsdom */
import { act, renderHook } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { useRef } from 'react';
import { useActionButtonInteractions } from './useActionButtonInteractions';
import { useActiveRecordings } from './useActiveRecordings';

it('A stops B only when A starts; stopping A preserves a restarted B', () => {
  const completed = vi.fn();
  const { result } = renderHook(() => {
    const recordings = useActiveRecordings([]);
    const { handleActionClick } = useActionButtonInteractions({
      ...recordings,
      activeMode: 'code',
      effectiveLinks: [{ from: 'A', to: 'B', type: 'deactivate' }],
      getCurrentTime: () => 10,
      updateLabelSelections: vi.fn(),
      setWarning: vi.fn(),
      completeRecording: (name) => {
        completed(name);
        recordings.setActiveRecordings((previous) => {
          const next = { ...previous };
          delete next[name];
          return next;
        });
      },
      recentActionsRef: useRef<string[]>([]),
      getButtonColorByName: () => undefined,
    });
    return {
      active: Object.keys(recordings.activeRecordings),
      click: (action: string) =>
        handleActionClick('Team', {
          action,
          types: [],
          results: [],
          groups: [],
        }),
    };
  });
  act(() => result.current.click('B'));
  act(() => result.current.click('A'));
  expect(completed.mock.calls).toEqual([['B']]);
  act(() => result.current.click('B'));
  expect(result.current.active).toEqual(['A', 'B']);
  act(() => result.current.click('A'));
  expect(completed.mock.calls).toEqual([['B'], ['A']]);
  expect(result.current.active).toEqual(['B']);
});
