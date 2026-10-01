/** @vitest-environment jsdom */
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import type { TimelineData } from '../../../../../../types/timeline/core';
import { useTimelineReview } from './useTimelineReview';
const items: TimelineData[] = Array.from({ length: 85 }, (_, i) => ({
  id: String(i),
  actionName: 'Review',
  startTime: i,
  endTime: i + 1,
  memo: i === 84 ? '終盤' : '',
}));
afterEach(cleanup);
it('shows every page and clamps it when live data changes without losing selection', () => {
  const { result, rerender } = renderHook(
    ({ data }) => useTimelineReview(data, ['84']),
    { initialProps: { data: items } },
  );
  expect(result.current.pageCount).toBe(3);
  act(() => result.current.onPageChange(2));
  expect(result.current.results).toHaveLength(5);
  act(() => result.current.onQueryChange('終盤'));
  expect(result.current.results.map((item) => item.id)).toEqual(['84']);
  expect(result.current.page).toBe(0);
  expect(result.current.selectedItem?.memo).toBe('終盤');
  rerender({ data: items.slice(0, 40) });
  expect(result.current.results).toEqual([]);
  expect(result.current.selectedItem).toBeNull();
});
it('opens search with command F and leaves dialogs to their existing shortcuts', () => {
  const { result } = renderHook(() => useTimelineReview(items, []));
  const dialog = document.createElement('div');
  dialog.role = 'dialog';
  document.body.append(dialog);
  const key = (): KeyboardEvent =>
    new KeyboardEvent('keydown', {
      key: 'f',
      metaKey: true,
      bubbles: true,
      cancelable: true,
    });
  const ignored = key();
  act(() => dialog.dispatchEvent(ignored));
  expect(result.current.open).toBe(false);
  expect(ignored.defaultPrevented).toBe(false);
  const find = key();
  act(() => window.dispatchEvent(find));
  expect(result.current.open).toBe(true);
  expect(find.defaultPrevented).toBe(true);
  dialog.remove();
});
