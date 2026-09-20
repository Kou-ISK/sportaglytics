import { app, BrowserWindow } from 'electron';

/** Raise the visible workspace as a group, retaining keyboard focus and OS levels. */
export const registerApplicationWindowActivation = (): (() => void) => {
  let raising = false;
  const onFocus = (_event: Electron.Event, focused: BrowserWindow): void => {
    if (raising || focused.isDestroyed()) return;
    raising = true;
    try {
      for (const window of BrowserWindow.getAllWindows()) {
        if (
          window === focused ||
          window.isDestroyed() ||
          !window.isVisible() ||
          window.isMinimized()
        )
          continue;
        window.moveTop();
      }
      if (!focused.isDestroyed()) focused.moveTop();
    } finally {
      raising = false;
    }
  };
  app.on('browser-window-focus', onFocus);
  return () => app.removeListener('browser-window-focus', onFocus);
};
