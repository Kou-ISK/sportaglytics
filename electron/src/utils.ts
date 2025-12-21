import { BrowserWindow, dialog, ipcMain, Menu, app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { PackageDatas } from '../../src/renderer';

// メインプロセスで使用するメソッドを切り出し

let mainWindow: Electron.BrowserWindow | null = null; // mainWindowをnullで初期化

export const setMainWindow = (window: Electron.BrowserWindow) => {
  mainWindow = window;
};

export const Utils = () => {
  ipcMain.handle('open-directory', async () => {
    if (!mainWindow) return { canceled: true };
    return dialog
      .showOpenDialog(mainWindow, {
        properties: ['openDirectory'],
        message: 'パッケージを選択する',
        filters: [
          {
            name: 'パッケージファイル',
            extensions: ['pkg'],
          },
        ],
      })
      .then((result) => {
        if (result.canceled) return;
        const selected = result.filePaths[0];
        if (selected) {
          try {
            app.addRecentDocument(selected);
          } catch (e) {
            console.warn('addRecentDocument failed', e);
          }
          try {
            // メニューを再構築して「最近開いたパッケージ」に反映
            const { refreshAppMenu } = require('./menuBar') as {
              refreshAppMenu: () => void;
            };
            refreshAppMenu();
          } catch (e) {
            console.warn('refreshAppMenu failed', e);
          }
        }
        return selected;
      })
      .catch((err) => console.log(`Error: ${err}`));
  });

  ipcMain.handle('open-file', async () => {
    if (!mainWindow) return { canceled: true };
    return dialog
      .showOpenDialog(mainWindow, {
        properties: ['openFile'],
        message: 'ファイルを選択する',
        filters: [
          {
            name: '映像ファイル',
            extensions: ['mov', 'mp4'],
          },
        ],
      })
      .then((result) => {
        if (result.canceled) return;
        return result.filePaths[0];
      })
      .catch((err) => console.log(`Error: ${err}`));
  });

  ipcMain.handle('export-timeline', async (_, filePath, source) => {
    const toJSON = JSON.stringify(source);
    fs.writeFile(filePath, toJSON, (error) => {
      console.log(error);
    });
  });

  ipcMain.handle(
    'create-package',
    async (
      _,
      directoryName,
      packageName,
      tightViewPath,
      wideViewPath,
      metaDataConfig,
    ) => {
      // 引数で取ったpackageNameをもとに新規パッケージを作成
      const newPackagePath = directoryName + '/' + packageName;
      const newFilePath = newPackagePath.substring(
        newPackagePath.lastIndexOf('/') + 1,
      );
      fs.mkdirSync(newPackagePath);
      fs.mkdirSync(newPackagePath + '/videos');
      // 新しいビデオファイルパスを変数に格納
      const newTightViewPath =
        newPackagePath + '/videos/' + newFilePath + ' 寄り.mp4';
      fs.renameSync(tightViewPath, newTightViewPath);
      // wideViewPathが存在する場合のみ書き出し
      let newWideViewPath = null;
      if (wideViewPath) {
        newWideViewPath =
          newPackagePath + '/videos/' + newFilePath + ' 引き.mp4';
        fs.renameSync(wideViewPath, newWideViewPath);
      }
      // タイムラインファイルを作成
      fs.writeFile(newPackagePath + '/timeline.json', '[]', (err) => {
        if (err) console.log(err);
      });
      // .metadataファイルを作成
      fs.mkdirSync(newPackagePath + '/.metadata');
      // パッケージ内の相対パスとして保存（移動しても動作するように）
      metaDataConfig.tightViewPath = 'videos/' + newFilePath + ' 寄り.mp4';
      metaDataConfig.wideViewPath = newWideViewPath
        ? 'videos/' + newFilePath + ' 引き.mp4'
        : null;
      const metaDataText = JSON.stringify(metaDataConfig);
      console.log(metaDataConfig);
      fs.writeFile(
        newPackagePath + '/.metadata/config.json',
        metaDataText,
        (err) => {
          if (err) console.log(err);
        },
      );
      /* 
        PackageName.pkg
        ┗ .metadata
            ┗ config.json (チーム名、シンク機能実装後は各ビデオアングルの開始秒数など)
        ┗ timeline.json
        ┗ videos
            ┗ tightView.mp4
            ┗ wideView.mp4
        */
      const packageDatas: PackageDatas = {
        timelinePath: newPackagePath + '/timeline.json',
        tightViewPath: newTightViewPath,
        wideViewPath: newWideViewPath,
        metaDataConfigFilePath: newPackagePath + '/.metadata/config.json',
      };
      console.log(packageDatas);
      return packageDatas;
    },
  );

  // ファイル存在確認ハンドラーを追加
  ipcMain.handle('check-file-exists', async (event, filePath: string) => {
    try {
      await fs.promises.access(filePath, fs.constants.F_OK);
      console.log(`ファイル存在確認: ${filePath} - 存在します`);
      return true;
    } catch (error) {
      console.log(`ファイル存在確認: ${filePath} - 存在しません`, error);
      return false;
    }
  });

  // JSONファイルを読み込み
  ipcMain.handle('read-json-file', async (event, filePath: string) => {
    try {
      const data = await fs.promises.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.error(`JSONファイル読み込みエラー: ${filePath}`, error);
      throw error;
    }
  });

  // 同期データを保存
  ipcMain.handle(
    'save-sync-data',
    async (
      _event,
      configPath: string,
      syncData: {
        syncOffset: number;
        isAnalyzed: boolean;
        confidenceScore?: number;
      },
    ) => {
      try {
        const raw = await fs.promises.readFile(configPath, 'utf-8');
        const json = JSON.parse(raw || '{}');
        json.syncData = {
          syncOffset: Number(syncData?.syncOffset) || 0,
          isAnalyzed: !!syncData?.isAnalyzed,
          confidenceScore:
            typeof syncData?.confidenceScore === 'number'
              ? syncData.confidenceScore
              : undefined,
        };
        await fs.promises.writeFile(
          configPath,
          JSON.stringify(json, null, 2),
          'utf-8',
        );
        return true;
      } catch (e) {
        console.error('save-sync-data error:', e);
        return false;
      }
    },
  );

  ipcMain.handle('set-manual-mode-checked', async (_, checked: boolean) => {
    try {
      const menu = Menu.getApplicationMenu();
      const item = menu?.getMenuItemById('toggle-manual-mode');
      if (item) {
        item.checked = checked;
      }
      console.log(`手動モードが${checked ? 'オン' : 'オフ'}になりました`);
      return true;
    } catch (error) {
      console.error('set-manual-mode-checked error:', error);
      return false;
    }
  });

  // 既存のconfig.jsonを相対パスに変換
  ipcMain.handle(
    'convert-config-to-relative-path',
    async (_, packagePath: string) => {
      try {
        const configPath = path.join(packagePath, '.metadata', 'config.json');

        try {
          await fs.promises.access(configPath, fs.constants.F_OK);
        } catch {
          console.warn(
            `[convert-config-to-relative-path] config.json not found: ${configPath}`,
          );
          return {
            success: false,
            error: 'config.json not found',
          };
        }

        const raw = await fs.promises.readFile(configPath, 'utf-8');
        const config = JSON.parse(raw ?? '{}');

        const packageRoot = path.resolve(packagePath);
        const videosDir = path.join(packageRoot, 'videos');

        const ensureRelativeVideoPath = async (value: unknown) => {
          if (typeof value !== 'string' || value.trim() === '') {
            return value;
          }

          const normalized = path.normalize(value);
          const resolved = path.isAbsolute(normalized)
            ? normalized
            : path.resolve(packageRoot, normalized);

          const relativeFromPackage = path.relative(packageRoot, resolved);
          const isInsidePackage =
            relativeFromPackage &&
            !relativeFromPackage.startsWith('..') &&
            !path.isAbsolute(relativeFromPackage);

          if (isInsidePackage) {
            if (!resolved.startsWith(videosDir + path.sep)) {
              console.warn(
                `[convert-config] ${resolved} は videos フォルダ外です。構成を見直してください。`,
              );
            }
            return relativeFromPackage.replace(/\\/g, '/');
          }

          const baseName = path.basename(resolved);
          const directCandidate = path.join(videosDir, baseName);
          const tryCandidate = async (candidatePath: string) => {
            try {
              await fs.promises.access(candidatePath, fs.constants.F_OK);
              const relative = path.relative(packageRoot, candidatePath);
              console.warn(
                `[convert-config] ${resolved} を ${relative} に更新します`,
              );
              return relative.replace(/\\/g, '/');
            } catch {
              return null;
            }
          };

          const directMatch = await tryCandidate(directCandidate);
          if (directMatch) {
            return directMatch;
          }

          try {
            const entries = await fs.promises.readdir(videosDir);
            const matched = entries.find(
              (entry) => entry.toLowerCase() === baseName.toLowerCase(),
            );
            if (matched) {
              const fallback = path.join(videosDir, matched);
              const relative = path.relative(packageRoot, fallback);
              console.warn(
                `[convert-config] ${resolved} を ${relative} に更新します`,
              );
              return relative.replace(/\\/g, '/');
            }
          } catch (scanError) {
            console.debug('videosフォルダの走査に失敗:', scanError);
          }

          console.warn(
            `[convert-config] ${resolved} はパッケージ外のため絶対パスのまま保持します`,
          );
          return resolved.replace(/\\/g, '/');
        };

        if (config.tightViewPath) {
          const converted = await ensureRelativeVideoPath(config.tightViewPath);
          if (converted !== config.tightViewPath) {
            config.tightViewPath = converted;
            console.log('tightViewPathを更新:', converted);
          }
        }

        if (config.wideViewPath) {
          const converted = await ensureRelativeVideoPath(config.wideViewPath);
          if (converted !== config.wideViewPath) {
            config.wideViewPath = converted;
            console.log('wideViewPathを更新:', converted);
          }
        }

        await fs.promises.writeFile(
          configPath,
          JSON.stringify(config, null, 2),
          'utf-8',
        );

        console.log('config.jsonを相対パスに変換しました:', configPath);
        return { success: true, config };
      } catch (error) {
        console.error('convert-config-to-relative-path error:', error);
        return { success: false, error: String(error) };
      }
    },
  );
};
