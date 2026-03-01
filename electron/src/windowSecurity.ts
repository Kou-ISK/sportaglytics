import type { BrowserWindow, WebContents } from 'electron';

const isAllowedNavigationUrl = (url: string): boolean => {
  return (
    url.startsWith('file://') ||
    url.startsWith('data:text/html') ||
    url === 'about:blank'
  );
};

export const applyWebContentsSecurity = (webContents: WebContents): void => {
  webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  webContents.on('will-navigate', (event, url) => {
    if (!isAllowedNavigationUrl(url)) {
      event.preventDefault();
    }
  });
};

export const applyWindowSecurity = (window: BrowserWindow): void => {
  applyWebContentsSecurity(window.webContents);
};

