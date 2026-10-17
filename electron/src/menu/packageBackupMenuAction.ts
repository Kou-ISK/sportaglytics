import { BrowserWindow, dialog } from 'electron';
import { getPackageSessionForWindow } from '../packageSessionRegistry';
import {
  readUpdateReceipt,
  strictPathExists,
} from '../ipc/packageUpdateJournal';
import { showPackageBackup } from '../ipc/packageOpenDialogs';

export const openPackageBackupFromMenu = async (
  window?: Electron.BaseWindow,
): Promise<void> => {
  const owner = window
    ? BrowserWindow.getAllWindows().find((item) => item.id === window.id)
    : BrowserWindow.getFocusedWindow();
  const source = owner ? getPackageSessionForWindow(owner)?.packagePath : null;
  if (owner && source) {
    try {
      const receipt = await readUpdateReceipt(source);
      if (receipt && (await strictPathExists(receipt.backupPath))) {
        await showPackageBackup(owner, receipt.backupPath);
        return;
      }
    } catch {
      /* Report unavailable backup without guessing another document. */
    }
  }
  await dialog.showMessageBox({
    type: 'info',
    title: '更新前のバックアップ',
    message: 'このウィンドウのバックアップは見つかりません',
    detail:
      '対象のパッケージを開いてから選んでください。バックアップを移動した場合は、保存した場所を確認してください。',
  });
};
