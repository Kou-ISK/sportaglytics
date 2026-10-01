/** @vitest-environment jsdom */
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import * as search from './timelineReviewSearch';
import type { TimelineData } from '../../../../../../types/timeline/core';
import { useTimelineReview } from './useTimelineReview';
const items: TimelineData[] = Array.from({ length: 85 }, (_, i) => ({
  id: String(i),
  actionName: 'Review',
  startTime: i,
  endTime: i + 1,
  memo: i === 84 ? '終盤' : '',
}));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it('shows every page and clamps it when live data changes without losing selection', () => {
  const { result, rerender } = renderHook(
    ({ data }) => useTimelineReview(data, ['84']),
    { initialProps: { data: items } },
  );
  act(() => result.current.onToggle());
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
it('clears only the review detail when selection no longer matches, and skips search while closed', () => {
  const scan = vi.spyOn(search, 'searchTimeline');
  const ids = ['84'];
  const { result, rerender } = renderHook(
    ({ data }) => useTimelineReview(data, ids),
    { initialProps: { data: items } },
  );
  expect(scan).not.toHaveBeenCalled();
  rerender({ data: [...items] });
  expect(scan).not.toHaveBeenCalled();
  act(() => result.current.onToggle());
  expect(result.current.selectedItem?.id).toBe('84');
  act(() => result.current.onQueryChange('一致しない語'));
  expect(result.current.selectedItem).toBeNull();
  expect(ids).toEqual(['84']);
  act(() => result.current.onClose());
  const count = scan.mock.calls.length;
  rerender({ data: [...items] });
  expect(scan).toHaveBeenCalledTimes(count);
});
it('handles Escape in review controls but lets dialogs and composition keep it', () => {
  const { result } = renderHook(() => useTimelineReview(items, []));
  act(() => result.current.onToggle());
  act(() => result.current.onQueryChange('終盤'));
  const dialog = document.createElement('div');
  dialog.role = 'dialog';
  document.body.append(dialog);
  const escape = (composing = false): KeyboardEvent =>
    new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
      isComposing: composing,
    });
  act(() => dialog.dispatchEvent(escape()));
  act(() => window.dispatchEvent(escape(true)));
  expect(result.current.query).toBe('終盤');
  act(() => window.dispatchEvent(escape()));
  expect(result.current.query).toBe('');
  expect(result.current.open).toBe(true);
  act(() => window.dispatchEvent(escape()));
  expect(result.current.open).toBe(false);
  dialog.remove();
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
