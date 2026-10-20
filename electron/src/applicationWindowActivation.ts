import { app, BrowserWindow } from 'electron';

const canRaise = (window: BrowserWindow): boolean =>
  !window.isDestroyed() && window.isVisible() && !window.isMinimized();

/** Raise the visible workspace as a group, retaining keyboard focus and OS levels. */
export const registerApplicationWindowActivation = (): (() => void) => {
  let raising = false;
  const onFocus = (_event: Electron.Event, focused: BrowserWindow): void => {
    // A queued focus notification can arrive after close has hidden the window.
    if (raising || !canRaise(focused)) return;
    raising = true;
    try {
      for (const window of BrowserWindow.getAllWindows()) {
        if (window === focused || !canRaise(window)) continue;
        window.moveTop();
      }
      if (canRaise(focused)) focused.moveTop();
    } finally {
      raising = false;
    }
  };
  app.on('browser-window-focus', onFocus);
  return () => app.removeListener('browser-window-focus', onFocus);
};
