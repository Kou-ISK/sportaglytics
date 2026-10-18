import type { BrowserWindow, WebContents } from 'electron';
import { isTrustedRendererUrl } from './rendererUrl';

export const applyWebContentsSecurity = (webContents: WebContents): void => {
  webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  webContents.on('will-navigate', (event, url) => {
    if (!isTrustedRendererUrl(url)) {
      event.preventDefault();
    }
  });
  // Do not block media iframe redirects (e.g. YouTube). Only the document that
  // owns the preload bridge must stay on the app entry point.
  webContents.on('will-redirect', (event) => {
    if (event.isMainFrame && !isTrustedRendererUrl(event.url)) {
      event.preventDefault();
    }
  });
};

export const applyWindowSecurity = (window: BrowserWindow): void => {
  applyWebContentsSecurity(window.webContents);
};
