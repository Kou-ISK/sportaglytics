import type { BrowserWindow } from 'electron';

const roles = new WeakMap<BrowserWindow, '再生画面' | 'タイムライン'>();

export const updateDocumentWindowTitle = (
  window: BrowserWindow,
  title: string,
): void => {
  if (window.isDestroyed()) return;
  const role = roles.get(window);
  const prefix = role ? `${role} — ` : '';
  window.setTitle(prefix && !title.startsWith(prefix) ? prefix + title : title);
};

/** HTML's common application title must not erase the native window's role. */
export const registerDocumentWindowTitle = (
  window: BrowserWindow,
  role: '再生画面' | 'タイムライン',
): void => {
  roles.set(window, role);
  updateDocumentWindowTitle(window, 'SporTagLytics');
  window.on('page-title-updated', (event, title) => {
    event.preventDefault();
    updateDocumentWindowTitle(window, title);
  });
};

/** Automatic companion windows must not take focus from the opened document. */
export const presentDocumentWindow = (
  window: BrowserWindow,
  activate: boolean,
): void => {
  if (window.isDestroyed()) return;
  if (!activate) {
    if (!window.isMinimized()) window.showInactive();
    return;
  }
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
};
