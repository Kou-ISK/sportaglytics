import { app, BrowserWindow, Menu, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'node:fs/promises';
import { spawn } from 'child_process';
import { Utils, setMainWindow } from './utils';
import { registerShortcuts } from './shortCutKey';
import { menuBar } from './menuBar';
import { registerSettingsHandlers, loadSettings } from './settingsManager';

// ローカル動画の自動再生を許可
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

const mainURL = `file:${__dirname}/../../index.html`;

const createWindow = async () => {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 1000,
    icon: path.join(__dirname, '../../public/icon.icns'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      // ローカル file:// リソースを許可（開発用）
      webSecurity: false,
      // セキュリティ: Preloadスクリプトからのみブリッジする
      contextIsolation: true,
      // Electron 31対応: sandboxは無効化（レガシー動作を維持）
      sandbox: false,
    },
  });
  setMainWindow(mainWindow);
  mainWindow.loadURL(mainURL);

  // 設定を読み込んでホットキーを登録
  const settings = await loadSettings();
  registerShortcuts(mainWindow, settings.hotkeys);

  Menu.setApplicationMenu(menuBar);

  // ホットキー設定が更新されたら再登録
  ipcMain.on('hotkeys-updated', () => {
    loadSettings().then((updatedSettings) => {
      registerShortcuts(mainWindow, updatedSettings.hotkeys);
    });
  });

  // ウィンドウタイトル更新用のIPCハンドラ
  ipcMain.on('set-window-title', (_event, title: string) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setTitle(title);
    }
  });

  // ファイル保存ダイアログ
  ipcMain.handle(
    'save-file-dialog',
    async (
      _event,
      defaultPath: string,
      filters: { name: string; extensions: string[] }[],
    ) => {
      const result = await dialog.showSaveDialog(mainWindow, {
        defaultPath,
        filters,
      });
      return result.canceled ? null : result.filePath;
    },
  );

  // ファイル選択ダイアログ
  ipcMain.handle(
    'open-file-dialog',
    async (_event, filters: { name: string; extensions: string[] }[]) => {
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters,
      });
      return result.canceled ? null : result.filePaths[0];
    },
  );

  // テキストファイル書き込み
  ipcMain.handle(
    'write-text-file',
    async (_event, filePath: string, content: string) => {
      try {
        await fs.writeFile(filePath, content, 'utf-8');
        return true;
      } catch (error) {
        console.error('Failed to write file:', error);
        return false;
      }
    },
  );

  // テキストファイル読み込み
  ipcMain.handle('read-text-file', async (_event, filePath: string) => {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return content;
    } catch (error) {
      console.error('Failed to read file:', error);
      return null;
    }
  });

  // クリップ書き出し（FFmpeg利用想定）
  ipcMain.handle(
    'export-clips-with-overlay',
    async (
      _event,
      payload: {
        sourcePath: string;
        sourcePath2?: string;
        mode?: 'single' | 'dual';
        outputDir?: string;
        clips: {
          id: string;
          actionName: string;
          startTime: number;
          endTime: number;
          labels?: { group: string; name: string }[];
          qualifier?: string;
          actionIndex?: number;
        }[];
        overlay: {
          enabled: boolean;
          showActionName: boolean;
          showActionIndex: boolean;
          showLabels: boolean;
          showQualifier: boolean;
          textTemplate: string;
        };
      },
    ) => {
      try {
        const { sourcePath, sourcePath2, mode = 'single', outputDir, clips, overlay } =
          payload;
        if (!sourcePath || clips.length === 0) {
          return { success: false, error: 'ソースまたはクリップがありません' };
        }

        let targetDir = outputDir;
        if (!targetDir) {
          const res = await dialog.showOpenDialog(mainWindow, {
            properties: ['openDirectory', 'createDirectory'],
          });
          if (res.canceled || res.filePaths.length === 0) {
            return { success: false, error: '書き出しがキャンセルされました' };
          }
          targetDir = res.filePaths[0];
        }

        const escapeDrawtext = (text: string) =>
          text
            .replace(/:/g, '\\:')
            .replace(/'/g, "\\'")
            .replace(/%/g, '\\%')
            .replace(/\n/g, ' ')
            .replace(/,/g, '\\,');

        const runFfmpegSingle = (
          clip: (typeof clips)[number],
          outputPath: string,
          overlayLines: string[],
        ) =>
          new Promise<void>((resolve, reject) => {
            const vf: string[] = [];
            if (overlay.enabled) {
              // 左寄せ、3行、下部帯。薄く小さくしてSportscode風に。
              const box =
                'drawbox=x=0:y=ih-120:w=iw:h=120:color=black@0.7:t=fill';
              vf.push(box);

              const linesConfig = [
                { color: 'white', size: 34, y: 'h-95', weight: 2 },
                { color: '#dcdcdc', size: 28, y: 'h-60', weight: 1.5 },
                { color: '#bbbbbb', size: 24, y: 'h-30', weight: 1 },
              ];

              overlayLines.forEach((line, idx) => {
                const safeText = escapeDrawtext(line);
                const cfg = linesConfig[idx] ?? linesConfig[linesConfig.length - 1];
                const text = `drawtext=text='${safeText}':fontcolor=${cfg.color}:fontsize=${cfg.size}:borderw=${cfg.weight}:bordercolor=black@0.85:x=20:y=${cfg.y}`;
                vf.push(text);
              });
            }
            const args = [
              '-y',
              '-ss',
              `${Math.max(0, clip.startTime)}`,
              '-t',
              `${Math.max(0.1, clip.endTime - clip.startTime)}`,
              '-i',
              sourcePath,
              ...(vf.length ? ['-vf', vf.join(',')] : []),
              '-c:v',
              'libx264',
              '-preset',
              'veryfast',
              '-c:a',
              'aac',
              outputPath,
            ];
            const ff = spawn('ffmpeg', args);
            ff.stderr.on('data', (data) => {
              console.log('[ffmpeg]', data.toString());
            });
            ff.on('close', (code) => {
              if (code === 0) resolve();
              else reject(new Error(`ffmpeg exited with code ${code}`));
            });
          });

        const runFfmpegDual = (
          clip: (typeof clips)[number],
          outputPath: string,
          overlayLines: string[],
        ) =>
          new Promise<void>((resolve, reject) => {
            if (!sourcePath2) {
              reject(new Error('2画面結合に必要な第2ソースがありません'));
              return;
            }
            const vf: string[] = [];
            // 2入力を横並び
            const overlayFilters: string[] = [];
            if (overlay.enabled) {
              const box =
                'drawbox=x=0:y=ih-120:w=iw:h=120:color=black@0.7:t=fill';
              overlayFilters.push(box);

              const linesConfig = [
                { color: 'white', size: 34, y: 'h-95' },
                { color: '#dcdcdc', size: 28, y: 'h-60' },
                { color: '#bbbbbb', size: 24, y: 'h-30' },
              ];

              overlayLines.forEach((line, idx) => {
                const safeText = escapeDrawtext(line);
                const cfg = linesConfig[idx] ?? linesConfig[linesConfig.length - 1];
                const text = `drawtext=text='${safeText}':fontcolor=${cfg.color}:fontsize=${cfg.size}:borderw=0:bordercolor=black@0.0:x=20:y=${cfg.y}`;
                overlayFilters.push(text);
              });
            }
            const filterComplex = [
              '[0:v][1:v]hstack=inputs=2[vbase]',
              overlayFilters.length
                ? `[vbase]${overlayFilters.join(',')}[vout]`
                : '[vbase][vout]',
            ].join(';');

            const args = [
              '-y',
              '-ss',
              `${Math.max(0, clip.startTime)}`,
              '-t',
              `${Math.max(0.1, clip.endTime - clip.startTime)}`,
              '-i',
              sourcePath,
              '-ss',
              `${Math.max(0, clip.startTime)}`,
              '-t',
              `${Math.max(0.1, clip.endTime - clip.startTime)}`,
              '-i',
              sourcePath2,
              '-filter_complex',
              filterComplex,
              '-map',
              overlay.enabled ? '[vout]' : '[vbase]',
              '-map',
              '0:a?',
              '-c:v',
              'libx264',
              '-preset',
              'veryfast',
              '-c:a',
              'aac',
              outputPath,
            ];
            const ff = spawn('ffmpeg', args);
            ff.stderr.on('data', (data) => console.log('[ffmpeg]', data.toString()));
            ff.on('close', (code) => {
              if (code === 0) resolve();
              else reject(new Error(`ffmpeg exited with code ${code}`));
            });
          });

        const formatLines = (clip: (typeof clips)[number]) => {
          const labelText = clip.labels
            ?.map((l) => `${l.group ? `${l.group}: ` : ''}${l.name}`)
            .join(', ');
          const line1 = `#${clip.actionIndex ?? 1} ${clip.actionName}`;
          const line2 = labelText || '';
          const line3 = clip.qualifier || '';
          return [line1, line2, line3].filter((l) => l.length > 0);
        };

        for (const clip of clips) {
          const safeAction = clip.actionName.replace(/\s+/g, '_');
          const outName = `${safeAction}_${clip.actionIndex ?? 1}_${Math.round(clip.startTime)}-${Math.round(clip.endTime)}${mode === 'dual' ? '_dual' : ''}.mp4`;
          const outPath = path.join(targetDir, outName);
          const overlayLines = formatLines(clip);
          if (mode === 'dual') {
            await runFfmpegDual(clip, outPath, overlayLines);
          } else {
            await runFfmpegSingle(clip, outPath, overlayLines);
          }
        }

        return { success: true };
      } catch (err) {
        console.error('export-clips-with-overlay error', err);
        return { success: false, error: String(err) };
      }
    },
  );
};
Utils();
registerSettingsHandlers();

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
