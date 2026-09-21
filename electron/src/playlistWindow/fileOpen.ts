import { BrowserWindow, dialog } from 'electron';
import { loadPlaylistFromPath } from './storage';
import { createPlaylistWindow } from './windowManager';

export const selectPlaylistPath = async (
  owner?: BrowserWindow | null,
): Promise<string | null> => {
  const options: Electron.OpenDialogOptions = {
    title: 'プレイリストを開く',
    filters: [{ name: 'SporTagLytics Playlist', extensions: ['stpl'] }],
    properties: ['openDirectory', 'treatPackageAsDirectory'],
  };
  const result =
    owner && !owner.isDestroyed()
      ? await dialog.showOpenDialog(owner, options)
      : await dialog.showOpenDialog(options);
  return result.canceled ? null : (result.filePaths[0] ?? null);
};

/** File > Open never replaces the document being edited in the focused window. */
export const openPlaylistFile = async (
  owner?: BrowserWindow | null,
): Promise<void> => {
  const parent = owner ?? BrowserWindow.getFocusedWindow();
  try {
    const filePath = await selectPlaylistPath(parent);
    if (!filePath || parent?.isDestroyed()) return;
    await loadPlaylistFromPath(filePath);
    if (parent?.isDestroyed()) return;
    createPlaylistWindow(filePath, parent);
  } catch (error) {
    const options: Electron.MessageBoxOptions = {
      type: 'error',
      title: 'プレイリストを開けませんでした',
      message: '有効なプレイリスト（.stpl）を選択してください。',
      detail: error instanceof Error ? error.message : String(error),
      buttons: ['OK'],
    };
    if (parent && !parent.isDestroyed())
      await dialog.showMessageBox(parent, options);
    else await dialog.showMessageBox(options);
  }
};
