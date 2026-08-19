/**
 * @vitest-environment jsdom
 */
import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import type { CodeWindowLayout } from '../../../../../types/settings/coreTypes';
import { useFreeCanvasHistoryAndShortcuts } from './useFreeCanvasHistoryAndShortcuts';

const initialLayout: CodeWindowLayout = {
  id: 'layout',
  name: 'Test',
  canvasWidth: 500,
  canvasHeight: 400,
  buttons: [
    {
      id: 'a',
      type: 'action',
      name: 'Attack',
      x: 20,
      y: 30,
      width: 100,
      height: 40,
    },
    {
      id: 'b',
      type: 'label',
      name: 'Result',
      labelValue: 'Good',
      x: 160,
      y: 90,
      width: 80,
      height: 40,
    },
  ],
  buttonLinks: [
    {
      id: 'ab',
      fromButtonId: 'a',
      toButtonId: 'b',
      type: 'activate',
    },
  ],
};

const dispatchShortcut = (
  key: string,
  options: KeyboardEventInit = {},
): void => {
  window.dispatchEvent(
    new KeyboardEvent('keydown', {
      key,
      metaKey: true,
      bubbles: true,
      ...options,
    }),
  );
};

const useHarness = () => {
  const [layout, setLayout] = useState(initialLayout);
  const [selectedButtonIds, setSelectedButtonIds] = useState(['a', 'b']);
  const shortcuts = useFreeCanvasHistoryAndShortcuts({
    layout,
    selectedButtonIds,
    onLayoutChange: setLayout,
    onSelectButtons: setSelectedButtonIds,
  });
  return { layout, selectedButtonIds, ...shortcuts };
};

describe('useFreeCanvasHistoryAndShortcuts', () => {
  it('copies and pastes the whole selected group as one history operation', () => {
    const { result } = renderHook(useHarness);

    act(() => dispatchShortcut('c'));
    act(() => dispatchShortcut('v'));

    expect(result.current.layout.buttons).toHaveLength(4);
    expect(result.current.layout.buttonLinks).toHaveLength(2);
    expect(result.current.selectedButtonIds).toHaveLength(2);
    expect(result.current.selectedButtonIds).not.toContain('a');
    expect(result.current.selectedButtonIds).not.toContain('b');

    act(() => dispatchShortcut('z'));
    expect(result.current.layout).toEqual(initialLayout);

    act(() => dispatchShortcut('z', { shiftKey: true }));
    expect(result.current.layout.buttons).toHaveLength(4);
    expect(result.current.layout.buttonLinks).toHaveLength(2);
  });

  it('deletes every selected button and attached link together', () => {
    const { result } = renderHook(useHarness);

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }),
      );
    });

    expect(result.current.layout.buttons).toEqual([]);
    expect(result.current.layout.buttonLinks).toEqual([]);
    expect(result.current.selectedButtonIds).toEqual([]);
  });

  it('selects every button with Command+A', () => {
    const { result } = renderHook(() => {
      const [layout, setLayout] = useState(initialLayout);
      const [selectedButtonIds, setSelectedButtonIds] = useState<string[]>([]);
      useFreeCanvasHistoryAndShortcuts({
        layout,
        selectedButtonIds,
        onLayoutChange: setLayout,
        onSelectButtons: setSelectedButtonIds,
      });
      return selectedButtonIds;
    });

    act(() => dispatchShortcut('a'));
    expect(result.current).toEqual(['a', 'b']);
  });
});
