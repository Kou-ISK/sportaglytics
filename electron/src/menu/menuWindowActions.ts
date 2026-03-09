import { Menu, app, BrowserWindow } from 'electron';
import { applyWindowSecurity } from '../windowSecurity';

export const openVersionInfoWindow = () => {
  const versionWindow = new BrowserWindow({
    width: 400,
    height: 200,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });
  applyWindowSecurity(versionWindow);
  versionWindow.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(`
    <h1>SportagLytics</h1>
    <p>バージョン: ${app.getVersion()}</p>
  `)}`,
  );
};

export const sendToFocusedWindow = (channel: string, ...args: unknown[]) => {
  const target =
    BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
  if (target && !target.isDestroyed()) {
    target.webContents.send(channel, ...args);
  }
};

export const applyBuiltMenu = (template: Electron.MenuItemConstructorOptions[]) => {
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
  return menu;
};
