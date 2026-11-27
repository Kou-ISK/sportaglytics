import { dialog } from 'electron';
import type { BrowserWindow } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { SportscodeBundleSelection } from '../../../src/shared/timeline/sportscodeImport';
import { listSportscodeBundleFiles } from './sportscodeBundle';
import { readSportscodeXmlSource } from './sportscodeImportService';

export const selectSportscodeBundle = async (
  window: BrowserWindow,
  selected?: string,
): Promise<SportscodeBundleSelection | null> => {
  let root = selected;
  if (!root) {
    const picked = await dialog.showOpenDialog(window, {
      title: 'Sportscodeパッケージを選択',
      properties:
        process.platform === 'darwin'
          ? ['openFile', 'openDirectory']
          : ['openDirectory'],
    });
    if (picked.canceled || !picked.filePaths[0]) return null;
    root = picked.filePaths[0];
  }
  const bundleRoot = root;
  const { xml, movies } = await listSportscodeBundleFiles(bundleRoot);
  const selectFile = async (
    files: string[],
    title: string,
    extensions: string[],
  ): Promise<string | null> => {
    if (files.length === 1) return files[0];
    const result = await dialog.showOpenDialog(window, {
      title,
      defaultPath: bundleRoot,
      properties: ['openFile', 'treatPackageAsDirectory'],
      filters: [{ name: title, extensions }],
    });
    if (result.canceled || !result.filePaths[0]) return null;
    const file = await fs.realpath(result.filePaths[0]);
    if (!files.includes(file))
      throw new Error('選択したパッケージ内の候補を選んでください。');
    return file;
  };
  const videoPath = movies.length
    ? await selectFile(movies, 'タイムラインに対応する連続映像を1本選択', [
        'mov',
        'mp4',
        'm4v',
        'webm',
      ])
    : '';
  if (movies.length && !videoPath) return null;
  const xmlPath = xml.length
    ? await selectFile(xml, '書き出したSportscode XMLを選択', ['xml'])
    : null;
  if (xml.length && !xmlPath) return null;
  return {
    name: path.basename(root).replace(/\.scpkg$/i, ''),
    videoPath: videoPath ?? '',
    videoDisplayName:
      videoPath && movies.length > 1
        ? `${path
            .relative(await fs.realpath(bundleRoot), videoPath)
            .split(path.sep)
            .join(
              '/',
            )}（候補${movies.length}本のうち、この1本のみ取り込みます）`
        : path.basename(videoPath ?? ''),
    xml: xmlPath ? await readSportscodeXmlSource(xmlPath) : null,
  };
};
