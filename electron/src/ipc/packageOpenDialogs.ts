import { dialog, shell } from 'electron';
import type { BrowserWindow } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import { packageUpdatePaths, strictPathExists } from './packageUpdateJournal';
import type { PackageContentChoice } from './packageMigrationCandidates';

export const choosePackageContent = async (
  window: BrowserWindow,
  choice: PackageContentChoice,
): Promise<string | null> => {
  const candidates = choice.candidates.slice(0, 8);
  const candidatesText = candidates
    .map((file, index) => `${index + 1}: ${file}`)
    .join('\n');
  const detail =
    choice.reason === 'untracked'
      ? 'この場所の内容を更新して、同じ名前で保存します。更新前の内容はバックアップに残します。\n以前に別のコピーで編集した場合は、そのコピーを選んでください。'
      : choice.reason === 'unavailable'
        ? '以前の保存先を確認できません。ドライブを接続して再試行するか、移動したコピーを選んでください。この場所の内容を使う場合、見つからないコピーの編集は取り込まれません。'
        : '複数の編集内容があるため、自動で選べません。使う内容を選んでください。選ばなかった内容と更新前の原本は残します。';
  const originalButton = 0;
  const selectButton = 1;
  const cancelButton = 2;
  const result = await dialog.showMessageBox(window, {
    type: 'question',
    title: 'ファイルを開く',
    message: '開く内容を確認',
    detail: `${detail}\n\n現在の場所: ${choice.source}${candidatesText ? `\n\n${candidatesText}` : ''}`,
    buttons: ['この場所の内容を使う', '別のコピーを選ぶ…', 'キャンセル'],
    defaultId: choice.reason === 'untracked' ? originalButton : selectButton,
    cancelId: cancelButton,
    noLink: true,
  });
  if (result.response === originalButton) return choice.source;
  if (result.response !== selectButton) return null;
  const selected = await dialog.showOpenDialog(window, {
    title: '編集したコピーを選択',
    defaultPath: candidates[0] ?? path.dirname(choice.source),
    properties:
      process.platform === 'darwin'
        ? ['openFile', 'openDirectory']
        : ['openDirectory'],
  });
  return selected.canceled ? null : (selected.filePaths[0] ?? null);
};

export const showPackageBackup = async (
  window: BrowserWindow,
  backupPath: string,
): Promise<void> => {
  const result = await dialog.showMessageBox(window, {
    type: 'info',
    title: 'ファイルを開く',
    message: '更新前の内容を復元できます',
    detail: `今後の編集は元の場所へ保存します。更新前の内容は次の場所に残しています。\n\n${backupPath}\n\n復元する場合は対象をアプリで閉じ、現在のファイルを別の場所に保管してから、このバックアップを元の場所へ戻してください。バックアップは自動削除しません。`,
    buttons: ['閉じる', '保存場所を表示'],
    defaultId: 1,
    cancelId: 0,
    noLink: true,
  });
  if (result.response === 1) shell.showItemInFolder(backupPath);
};

export const showPackageRecovery = async (
  window: BrowserWindow,
  source: string,
): Promise<void> => {
  const parent = await fs.realpath(path.dirname(source));
  const work = packageUpdatePaths(
    path.join(parent, path.basename(source)),
  ).work;
  const result = await dialog.showMessageBox(window, {
    type: 'warning',
    title: 'ファイルを開く',
    message: '更新途中の内容を保持しました',
    detail: `このファイルへの保存は開始していません。元の場所からもう一度開くと復旧を試みます。次の作業フォルダは削除せず保管してください。\n\n${work}`,
    buttons: ['閉じる', '保存場所を表示'],
    defaultId: 0,
    cancelId: 0,
    noLink: true,
  });
  if (result.response === 1)
    shell.showItemInFolder((await strictPathExists(work)) ? work : parent);
};
