import { BrowserWindow, dialog } from 'electron';
import { getPackageSessionForWindow } from '../packageSessionRegistry';
import { isSenderPlaylistWindow } from '../playlistWindow/windowManager';
import { requestTimelineClipExport } from '../timelineWindow';

/** Route to the focused document's export UI, never to an unrelated package. */
export const openClipExportFromMenu = async (
  window?: Electron.BaseWindow,
): Promise<void> => {
  const owner = window
    ? BrowserWindow.getAllWindows().find(
        (candidate) => candidate.id === window.id,
      )
    : BrowserWindow.getFocusedWindow();
  if (owner && !owner.isDestroyed()) {
    if (isSenderPlaylistWindow(owner.webContents)) {
      owner.webContents.send('menu-export-clips');
      return;
    }
    const session = getPackageSessionForWindow(owner);
    if (session?.packagePath) {
      await requestTimelineClipExport(session.mainWindow);
      return;
    }
  }
  await dialog.showMessageBox({
    type: 'info',
    title: '映像の書き出し',
    message: '書き出すパッケージまたはプレイリストを開いてください。',
    detail:
      '複数のパッケージを開いている場合は、書き出す映像のウィンドウを選んでから実行してください。',
  });
};
