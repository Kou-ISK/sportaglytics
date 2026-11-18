// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useTimelineRowSelectionFocus } from './useTimelineRowSelectionFocus';
import type { TimelineRowInteractions } from './useTimelineRowInteractions';

type Menu = TimelineRowInteractions['rowContextMenu'];
const menu: Menu = { rowId: 'row', mouseX: 1, mouseY: 1 };
const setup = () => {
  const target = document.createElement('div'); target.tabIndex = 0;
  const paper = document.createElement('div');
  const item = document.createElement('button'); paper.append(item);
  const outside = document.createElement('button');
  document.body.append(target, paper, outside);
  const targetRef = { current: target };
  let serial = 0;
  const callbacks = new Map<number, FrameRequestCallback>();
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback): number => {
    callbacks.set(++serial, callback); return serial;
  });
  const cancel = vi.fn(); vi.stubGlobal('cancelAnimationFrame', cancel);
  const hook = renderHook(({ value }: { value: Menu }) =>
    useTimelineRowSelectionFocus(value, targetRef), { initialProps: { value: menu } });
  const select = (): void => {
    act(() => hook.result.current.select()); hook.rerender({ value: null });
  };
  const exit = (): FrameRequestCallback => {
    act(() => hook.result.current.exited(paper));
    const callback = callbacks.get(serial); if (!callback) throw Error('No exit frame');
    paper.remove(); return callback;
  };
  return { target, targetRef, paper, item, outside, hook, cancel, select, exit, callbacks };
};
afterEach(() => { cleanup(); document.body.replaceChildren(); vi.unstubAllGlobals(); });

it('waits for actual portal removal before restoring a late menu focus', () => {
  const s = setup(); s.select(); s.item.focus();
  const callback = s.exit();
  expect(document.activeElement).toBe(document.body);
  act(() => callback(1)); expect(document.activeElement).toBe(s.target);
});
it('does not steal an explicit outside focus before or after transition exit', () => {
  const s = setup(); s.select(); s.item.focus(); const callback = s.exit();
  s.outside.focus(); act(() => callback(1)); expect(document.activeElement).toBe(s.outside);
});
it('revokes a scheduled handoff when another menu opens, even if its old callback arrives', () => {
  const s = setup(); s.select(); s.item.focus(); const callback = s.exit();
  s.hook.rerender({ value: { rowId: 'new-row', mouseX: 2, mouseY: 2 } });
  s.outside.focus(); s.hook.rerender({ value: null });
  act(() => callback(1)); expect(document.activeElement).toBe(s.outside);
  expect(s.cancel).toHaveBeenCalled();
});
it('revokes a scheduled callback on unmount and cannot focus a replacement target', () => {
  const s = setup(); s.select(); s.item.focus(); const callback = s.exit();
  s.hook.unmount(); s.outside.focus(); act(() => callback(1));
  expect(document.activeElement).toBe(s.outside); expect(s.cancel).toHaveBeenCalled();
});
it('does not treat ordinary dismissal as a selection or focus a still-connected portal', () => {
  const s = setup(); s.hook.rerender({ value: null });
  act(() => s.hook.result.current.exited(s.paper)); expect(s.cancel).not.toHaveBeenCalled();
  s.hook.rerender({ value: menu }); s.select(); s.item.focus();
  act(() => s.hook.result.current.exited(s.paper));
  // The actual element-removal boundary is required, even after onExited.
  act(() => { for (const callback of s.callbacks.values()) callback(1); });
  expect(document.activeElement).toBe(s.item);
});
