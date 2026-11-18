import { useCallback, useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import type { TimelineRowInteractions } from './useTimelineRowInteractions';

/** A selection command owns one focus handoff after the closing MUI portal.
 * Escape/backdrop dismissal and a later menu keep their normal ownership. */
export const useTimelineRowSelectionFocus = (
  menu: TimelineRowInteractions['rowContextMenu'],
  targetRef: RefObject<HTMLDivElement | null>,
): {
  select: () => void;
  exited: (element: HTMLElement) => void;
} => {
  const pending = useRef(false);
  const epoch = useRef(0);
  const frame = useRef<number | null>(null);
  const currentMenu = useRef(menu);
  currentMenu.current = menu;
  const cancel = useCallback((): void => {
    pending.current = false;
    epoch.current++;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
  }, []);
  useEffect(() => {
    if (menu !== null) cancel();
    else if (pending.current) {
      // Preserve the immediate post-close handoff after FocusTrap restoration;
      // the exit handoff below also covers a later autofocus before unmount.
      targetRef.current?.focus({ preventScroll: true });
    }
  }, [menu, cancel, targetRef]);
  useEffect(() => cancel, [cancel]);
  const select = useCallback((): void => {
    cancel();
    pending.current = currentMenu.current !== null;
    targetRef.current?.focus({ preventScroll: true });
  }, [targetRef, cancel]);
  const exited = useCallback((element: HTMLElement): void => {
    if (!pending.current || currentMenu.current !== null) return;
    pending.current = false;
    const target = targetRef.current;
    if (!target) return;
    const ownsFocus = (): boolean => {
      const active = target.ownerDocument.activeElement;
      return active === target.ownerDocument.body ||
        (active !== null && (target.contains(active) || element.contains(active)));
    };
    if (!ownsFocus()) return;
    // onExited runs before Modal commits its portal removal. One render frame
    // crosses that commit; never refocus an exiting node or poll with a timer.
    const expected = epoch.current;
    frame.current = requestAnimationFrame(() => {
      if (epoch.current !== expected) return;
      frame.current = null;
      if (currentMenu.current === null && targetRef.current === target &&
          target.isConnected && !element.isConnected && ownsFocus())
        target.focus({ preventScroll: true });
    });
  }, [targetRef]);
  return { select, exited };
};
