import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'node:fs/promises';
import { spawn } from 'child_process';
import * as os from 'os';
import ffmpegPath from 'ffmpeg-static';
import { Utils, setMainWindow } from './utils';
import { registerShortcuts } from './shortCutKey';
import { refreshAppMenu, setRecentPackagePaths } from './menuBar';
import { registerSettingsHandlers, loadSettings } from './settingsManager';
import {
  registerPlaylistHandlers,
  setMainWindowRef,
  sendPlaylistFileToWindow,
} from './playlistWindow';
import { registerSettingsWindowHandlers } from './settingsWindow';

// ローカル動画の自動再生を許可（appが未定義の環境ではスキップ）
if (app?.commandLine) {
  app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
}

/**
 * バンドルされたffmpegバイナリのパスを取得
 * @returns ffmpegの実行可能パス
 * @throws ffmpegバイナリが見つからない場合
 */
const getFfmpegPath = (): string => {
  if (!ffmpegPath) {
    throw new Error(
      'ffmpeg binary not found. Please ensure ffmpeg-static is properly installed.',
    );
  }

  // パッケージ版の場合、asar.unpackedパスに変換
  if (app.isPackaged) {
    return ffmpegPath.replace('app.asar', 'app.asar.unpacked');
  }

  // 開発環境ではそのまま使用
  return ffmpegPath;
};

const mainURL = `file:${__dirname}/../../index.html`;

/**
 * コマンドライン引数からファイルパスを検出
 * .stpl, .stcw, .stpkg, .json を認識
 */
const pickFileArg = (argv: string[]): string | null => {
  return (
    argv.find((a) => {
      const ext = path.extname(a).toLowerCase();
      return (
        ext === '.stpl' ||
        ext === '.stcw' ||
        ext === '.stpkg' ||
        ext === '.json'
      );
    }) || null
  );
};

let pendingFile: string | null = pickFileArg(process.argv.slice(1));
let pendingCodeWindowExternalOpen: string | null = null;

// メインウィンドウの参照を保持
let mainWindow: BrowserWindow | null = null;

const createWindow = async (): Promise<BrowserWindow> => {
  const window = new BrowserWindow({
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
  mainWindow = window; // グローバル変数に保存
  setMainWindow(window);
  setMainWindowRef(window);
  window.loadURL(mainURL);

  // ウィンドウの読み込み完了を待つ
  await new Promise<void>((resolve) => {
    window.webContents.once('did-finish-load', () => {
      resolve();
    });
  });

  // 設定を読み込んでホットキーを登録
  const settings = await loadSettings();
  registerShortcuts(window, settings.hotkeys);

  refreshAppMenu();

  // ホットキー設定が更新されたら再登録
  ipcMain.on('hotkeys-updated', () => {
    loadSettings().then((updatedSettings) => {
      registerShortcuts(window, updatedSettings.hotkeys);
    });
  });

  ipcMain.on('recent-packages:update', (_event, paths: string[]) => {
    if (Array.isArray(paths)) {
      setRecentPackagePaths(paths);
      refreshAppMenu();
    }
  });

  // ウィンドウタイトル更新用のIPCハンドラ
  ipcMain.on('set-window-title', (_event, title: string) => {
    if (window && !window.isDestroyed()) {
      window.setTitle(title);
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
      const result = await dialog.showSaveDialog(window, {
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
      const result = await dialog.showOpenDialog(window, {
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

  // コードウィンドウファイル保存
  ipcMain.handle(
    'code-window:save-file',
    async (_event, codeWindow: unknown, filePath?: string) => {
      try {
        let targetPath = filePath;
        if (!targetPath) {
          const result = await dialog.showSaveDialog(window, {
            defaultPath: 'CodeWindow.stcw',
            filters: [
              { name: 'コードウィンドウファイル', extensions: ['stcw'] },
              { name: 'すべてのファイル', extensions: ['*'] },
            ],
          });
          if (result.canceled || !result.filePath) return null;
          targetPath = result.filePath;
        }

        const content = JSON.stringify(codeWindow, null, 2);
        await fs.writeFile(targetPath, content, 'utf-8');
        return targetPath;
      } catch (error) {
        console.error('Failed to save code window file:', error);
        return null;
      }
    },
  );

  // コードウィンドウファイル読み込み
  ipcMain.handle('code-window:load-file', async (_event, filePath?: string) => {
    try {
      let targetPath = filePath;
      if (!targetPath) {
        const result = await dialog.showOpenDialog(window, {
          properties: ['openFile'],
          filters: [
            { name: 'コードウィンドウファイル', extensions: ['stcw'] },
            { name: 'すべてのファイル', extensions: ['*'] },
          ],
        });
        if (result.canceled || result.filePaths.length === 0) return null;
        targetPath = result.filePaths[0];
      }

      const content = await fs.readFile(targetPath, 'utf-8');
      const codeWindow = JSON.parse(content);
      return { codeWindow, filePath: targetPath };
    } catch (error) {
      console.error('Failed to load code window file:', error);
      return null;
    }
  });

  ipcMain.handle('code-window:peek-external-open', async () => {
    return pendingCodeWindowExternalOpen;
  });

  ipcMain.handle(
    'code-window:consume-external-open',
    async (_event, expectedPath?: string) => {
      if (!pendingCodeWindowExternalOpen) return null;
      if (expectedPath && pendingCodeWindowExternalOpen !== expectedPath) {
        return null;
      }
      const nextPath = pendingCodeWindowExternalOpen;
      pendingCodeWindowExternalOpen = null;
      return nextPath;
    },
  );

  // クリップ書き出し（FFmpeg利用想定）
  ipcMain.handle(
    'export-clips-with-overlay',
    async (
      _event,
      payload: {
        sourcePath: string;
        sourcePath2?: string;
        mode?: 'single' | 'dual';
        exportMode?: 'single' | 'perInstance' | 'perRow';
        angleOption?: 'all' | 'angle1' | 'angle2';
        outputDir?: string;
        outputFileName?: string;
        clips: {
          id: string;
          actionName: string;
          startTime: number;
          endTime: number;
          freezeAt?: number | null;
          freezeDuration?: number;
          labels?: { group: string; name: string }[];
          memo?: string;
          actionIndex?: number;
          annotationPngPrimary?: string | null;
          annotationPngSecondary?: string | null;
        }[];
        overlay: {
          enabled: boolean;
          showActionName: boolean;
          showActionIndex: boolean;
          showLabels: boolean;
          showMemo: boolean;
          textTemplate: string;
        };
      },
    ) => {
      const tempFiles: string[] = [];
      try {
        const {
          sourcePath,
          sourcePath2,
          mode = 'single',
          exportMode = 'single',
          angleOption = 'all',
          outputDir,
          clips,
          overlay,
          outputFileName,
        } = payload;
        if (!sourcePath || clips.length === 0) {
          return { success: false, error: 'ソースまたはクリップがありません' };
        }

        const dataUrlToTempFile = async (
          dataUrl: string,
          prefix: string,
        ): Promise<string> => {
          const match = dataUrl.match(/^data:(.+);base64,(.*)$/);
          if (!match) {
            throw new Error('Invalid data URL for annotation overlay');
          }
          const buffer = Buffer.from(match[2], 'base64');
          const tempPath = path.join(
            os.tmpdir(),
            `${prefix}_${Date.now()}_${Math.random()}.png`,
          );
          await fs.writeFile(tempPath, buffer);
          return tempPath;
        };

        const mainSource =
          angleOption === 'angle2' ? sourcePath2 || sourcePath : sourcePath;
        const secondarySource =
          angleOption === 'all' ? sourcePath2 || null : null;
        const useDual = mode === 'dual' || Boolean(secondarySource);

        let targetDir = outputDir;
        if (!targetDir) {
          const res = await dialog.showOpenDialog(window, {
            properties: ['openDirectory', 'createDirectory'],
          });
          if (res.canceled || res.filePaths.length === 0) {
            return { success: false, error: '書き出しがキャンセルされました' };
          }
          targetDir = res.filePaths[0];
        }

        // OS判定で日本語フォントパスを取得
        const getJapaneseFontPath = (isBold = false): string => {
          const platform = os.platform();
          if (platform === 'darwin') {
            // macOS - Use Hiragino Kaku Gothic with appropriate weight
            // W6 (Semi-Bold) for normal text, W8 (Extra-Bold) for bold
            return isBold
              ? '/System/Library/Fonts/ヒラギノ角ゴシック W8.ttc'
              : '/System/Library/Fonts/ヒラギノ角ゴシック W6.ttc';
          } else if (platform === 'win32') {
            // Windows
            return isBold
              ? 'C:\\\\Windows\\\\Fonts\\\\meiryob.ttc'
              : 'C:\\\\Windows\\\\Fonts\\\\meiryo.ttc';
          } else {
            // Linux
            return isBold
              ? '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'
              : '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc';
          }
        };

        // テキストを60文字ごとに自動改行（英語は空白で区切る）
        const wrapText = (text: string, maxChars = 60): string => {
          if (text.length <= maxChars) return text;
          const lines: string[] = [];
          let currentLine = '';
          const words = text.split(' ');

          for (const word of words) {
            if (currentLine.length + word.length + 1 > maxChars) {
              if (currentLine) lines.push(currentLine);
              currentLine = word;
            } else {
              currentLine = currentLine ? `${currentLine} ${word}` : word;
            }
          }
          if (currentLine) lines.push(currentLine);
          return lines.join('\n');
        };

        const escapeDrawtext = (text: string) => {
          const wrapped = wrapText(text, 60);
          return wrapped
            .replace(/\\/g, '\\\\')
            .replace(/:/g, '\\:')
            .replace(/'/g, "'\\''")
            .replace(/%/g, '\\%')
            .replace(/,/g, '\\,');
        };

        const runFfmpegSingle = (
          clip: (typeof clips)[number] & {
            annotationPngPrimary?: string | null;
            freezeAt?: number | null;
            freezeDuration?: number;
          },
          outputPath: string,
          overlayLines: Array<{ text: string; isBold: boolean }>,
          annotationPath?: string | null,
        ) =>
          new Promise<void>((resolve, reject) => {
            const vfTexts: string[] = [];
            if (overlay.enabled) {
              // 実際の表示行数を計算（\nを含む行も考慮）
              const totalDisplayLines = overlayLines.reduce((acc, line) => {
                const lineCount = (line.text.match(/\n/g) || []).length + 1;
                return acc + lineCount;
              }, 0);

              console.log(
                '[Overlay Debug] overlayLines:',
                overlayLines.length,
                'totalDisplayLines:',
                totalDisplayLines,
              );
              overlayLines.forEach((line, idx) => {
                console.log(
                  `[Overlay Debug] Line ${idx}:`,
                  line.text,
                  'isBold:',
                  line.isBold,
                );
              });

              // 行数に応じて動的にボックス高さを計算
              const boxHeight = Math.max(60, 60 + (totalDisplayLines - 1) * 35);
              console.log('[Overlay Debug] boxHeight:', boxHeight);
              const box = `drawbox=x=0:y=ih-${boxHeight}:w=iw:h=${boxHeight}:color=black@0.7:t=fill`;
              vfTexts.push(box);

              const linesConfig = [
                {
                  color: 'white',
                  size: 34,
                  y: `h-${boxHeight - 25}`,
                  isBold: true,
                },
                {
                  color: '#dcdcdc',
                  size: 28,
                  y: `h-${Math.max(30, boxHeight - 60)}`,
                  isBold: false,
                },
                {
                  color: '#bbbbbb',
                  size: 24,
                  y: `h-${Math.max(30, boxHeight - 90)}`,
                  isBold: false,
                },
              ];

              overlayLines.forEach((line, idx) => {
                const safeText = escapeDrawtext(line.text);
                const cfg =
                  linesConfig[idx] ?? linesConfig[linesConfig.length - 1];

                // Try to use Japanese font, but don't fail if not available
                let fontParam = '';
                try {
                  const fontPath = getJapaneseFontPath(line.isBold);
                  console.log(
                    `[Font Debug] Line ${idx}, isBold: ${line.isBold}, fontPath: ${fontPath}`,
                  );
                  // Note: We don't check file existence here as it would be async
                  // If font doesn't exist, ffmpeg will fall back to default
                  fontParam = `fontfile='${fontPath}':`;
                } catch (e) {
                  // Use default font if error occurs
                  console.log('[Font Debug] Error getting font path:', e);
                  fontParam = '';
                }

                const text = `drawtext=${fontParam}text='${safeText}':fontcolor=${cfg.color}:fontsize=${cfg.size}:borderw=0:shadowcolor=black@0.55:shadowx=2:shadowy=2:x=20:y=${cfg.y}`;
                console.log(`[Font Debug] drawtext filter: ${text}`);
                vfTexts.push(text);
              });
            }

            const filterSteps: string[] = [];
            let baseLabel = '[0:v]';
            let mapLabel = '0:v';
            let audioMap = '0:a?';
            const inputArgs = [
              '-y',
              '-ss',
              `${Math.max(0, clip.startTime)}`,
              '-t',
              `${Math.max(0.5, clip.endTime - clip.startTime)}`,
              '-i',
              mainSource,
            ];

            // freeze clone
            const clipDuration = Math.max(0.5, clip.endTime - clip.startTime);
            const freezeAt =
              clip.freezeAt !== null && clip.freezeAt !== undefined
                ? Math.max(0, Math.min(clip.freezeAt, clipDuration))
                : null;
            const freezeDuration = clip.freezeDuration ?? 0;
            if (freezeAt !== null && freezeDuration > 0) {
              filterSteps.push(
                `[0:v]trim=end=${freezeAt},setpts=PTS-STARTPTS[vpre]`,
              );
              filterSteps.push(
                `[0:v]trim=start=${freezeAt},setpts=PTS-STARTPTS[vpost]`,
              );
              filterSteps.push(
                `[vpre]tpad=stop_mode=clone:stop_duration=${freezeDuration}[vprepad]`,
              );
              filterSteps.push(`[vprepad][vpost]concat=n=2:v=1:a=0[vfreeze]`);
              baseLabel = '[vfreeze]';
              mapLabel = baseLabel;
              filterSteps.push(
                `[0:a]atrim=end=${freezeAt},asetpts=PTS-STARTPTS[apre]`,
              );
              filterSteps.push(
                `[0:a]atrim=start=${freezeAt},asetpts=PTS-STARTPTS[apost]`,
              );
              filterSteps.push(`[apre]apad=pad_dur=${freezeDuration}[aprepad]`);
              filterSteps.push(`[aprepad][apost]concat=n=2:v=0:a=1[afreeze]`);
              audioMap = '[afreeze]';
            }

            if (annotationPath) {
              inputArgs.push('-i', annotationPath);
              const enableExpr =
                freezeAt !== null && freezeDuration > 0
                  ? `:enable='between(t,${freezeAt},${freezeAt + freezeDuration})'`
                  : '';
              filterSteps.push(`[1:v]format=rgba[ovrraw]`);
              filterSteps.push(`[ovrraw]${baseLabel}scale2ref[ovr][bbase]`);
              filterSteps.push(`[bbase][ovr]overlay=0:0${enableExpr}[vanno]`);
              baseLabel = '[vanno]';
              mapLabel = baseLabel;
            }
            if (vfTexts.length) {
              filterSteps.push(
                `${baseLabel}${vfTexts.length ? `,${vfTexts.join(',')}` : ''}[vout]`,
              );
              mapLabel = '[vout]';
            }

            const args = [...inputArgs];
            if (filterSteps.length) {
              args.push(
                '-filter_complex',
                filterSteps.join(';'),
                '-map',
                mapLabel,
              );
            } else {
              args.push('-map', '0:v');
            }
            args.push(
              '-c:v',
              'libx264',
              '-preset',
              'veryfast',
              '-c:a',
              'aac',
              '-map',
              audioMap,
              outputPath,
            );
            const ff = spawn(getFfmpegPath(), args);
            ff.stderr.on('data', (data) => {
              console.log('[ffmpeg]', data.toString());
            });
            ff.on('close', (code) => {
              if (code === 0) resolve();
              else reject(new Error(`ffmpeg exited with code ${code}`));
            });
          });

        const runFfmpegDual = (
          clip: (typeof clips)[number] & {
            freezeAt?: number | null;
            freezeDuration?: number;
          },
          outputPath: string,
          overlayLines: Array<{ text: string; isBold: boolean }>,
          annotationPrimary?: string | null,
          annotationSecondary?: string | null,
        ) =>
          new Promise<void>((resolve, reject) => {
            if (!secondarySource) {
              reject(new Error('2画面結合に必要な第2ソースがありません'));
              return;
            }
            const filterSteps: string[] = [];
            let mainLabel = '[0:v]';
            let subLabel = '[1:v]';
            let audioMap = '0:a?';
            const clipDuration = Math.max(0.5, clip.endTime - clip.startTime);
            const freezePos =
              clip.freezeAt !== null && clip.freezeAt !== undefined
                ? Math.max(0, Math.min(clip.freezeAt, clipDuration))
                : null;
            const freezeDur = clip.freezeDuration ?? 0;
            const inputs = [
              '-y',
              '-ss',
              `${Math.max(0, clip.startTime)}`,
              '-t',
              `${Math.max(0.5, clip.endTime - clip.startTime)}`,
              '-i',
              mainSource,
              '-ss',
              `${Math.max(0, clip.startTime)}`,
              '-t',
              `${Math.max(0.5, clip.endTime - clip.startTime)}`,
              '-i',
              secondarySource,
            ];
            let currentInputIndex = 2;

            // freeze main
            if (freezePos !== null && freezeDur > 0) {
              filterSteps.push(
                `[0:v]trim=end=${freezePos},setpts=PTS-STARTPTS[mvpre]`,
              );
              filterSteps.push(
                `[0:v]trim=start=${freezePos},setpts=PTS-STARTPTS[mvpost]`,
              );
              filterSteps.push(
                `[mvpre]tpad=stop_mode=clone:stop_duration=${freezeDur}[mvprepad]`,
              );
              filterSteps.push(
                `[mvprepad][mvpost]concat=n=2:v=1:a=0[mvfreeze]`,
              );
              mainLabel = '[mvfreeze]';
              filterSteps.push(
                `[0:a]atrim=end=${freezePos},asetpts=PTS-STARTPTS[apre]`,
              );
              filterSteps.push(
                `[0:a]atrim=start=${freezePos},asetpts=PTS-STARTPTS[apost]`,
              );
              filterSteps.push(`[apre]apad=pad_dur=${freezeDur}[aprepad]`);
              filterSteps.push(`[aprepad][apost]concat=n=2:v=0:a=1[afreeze]`);
              audioMap = '[afreeze]';
            }
            // freeze sub
            if (freezePos !== null && freezeDur > 0) {
              filterSteps.push(
                `[1:v]trim=end=${freezePos},setpts=PTS-STARTPTS[svpre]`,
              );
              filterSteps.push(
                `[1:v]trim=start=${freezePos},setpts=PTS-STARTPTS[svpost]`,
              );
              filterSteps.push(
                `[svpre]tpad=stop_mode=clone:stop_duration=${freezeDur}[svprepad]`,
              );
              filterSteps.push(
                `[svprepad][svpost]concat=n=2:v=1:a=0[svfreeze]`,
              );
              subLabel = '[svfreeze]';
            }

            if (annotationPrimary) {
              inputs.push('-i', annotationPrimary);
              const enableExpr =
                freezePos !== null && freezeDur > 0
                  ? `:enable='between(t,${freezePos},${freezePos + freezeDur})'`
                  : '';
              filterSteps.push(`[${currentInputIndex}:v]format=rgba[ovpraw]`);
              filterSteps.push(`[ovpraw]${mainLabel}scale2ref[ovp][mbase]`);
              filterSteps.push(`[mbase][ovp]overlay=0:0${enableExpr}[vp]`);
              mainLabel = '[vp]';
              currentInputIndex += 1;
            }
            if (annotationSecondary) {
              inputs.push('-i', annotationSecondary);
              const enableExpr =
                freezePos !== null && freezeDur > 0
                  ? `:enable='between(t,${freezePos},${freezePos + freezeDur})'`
                  : '';
              filterSteps.push(`[${currentInputIndex}:v]format=rgba[ovsraw]`);
              filterSteps.push(`[ovsraw]${subLabel}scale2ref[ovs][sbase]`);
              filterSteps.push(`[sbase][ovs]overlay=0:0${enableExpr}[vs]`);
              subLabel = '[vs]';
              currentInputIndex += 1;
            }

            // 2入力を横並び
            filterSteps.push(`${mainLabel}${subLabel}hstack=inputs=2[vbase]`);

            if (overlay.enabled) {
              const overlayFilters: string[] = [];

              // 実際の表示行数を計算（\nを含む行も考慮）
              const totalDisplayLines = overlayLines.reduce((acc, line) => {
                const lineCount = (line.text.match(/\n/g) || []).length + 1;
                return acc + lineCount;
              }, 0);

              console.log(
                '[Overlay Debug Dual] overlayLines:',
                overlayLines.length,
                'totalDisplayLines:',
                totalDisplayLines,
              );

              // 行数に応じて動的にボックス高さを計算
              const boxHeight = Math.max(60, 60 + (totalDisplayLines - 1) * 35);
              console.log('[Overlay Debug Dual] boxHeight:', boxHeight);
              const box = `drawbox=x=0:y=ih-${boxHeight}:w=iw:h=${boxHeight}:color=black@0.7:t=fill`;
              overlayFilters.push(box);

              const linesConfig = [
                {
                  color: 'white',
                  size: 34,
                  y: `h-${boxHeight - 25}`,
                  isBold: true,
                },
                {
                  color: '#dcdcdc',
                  size: 28,
                  y: `h-${Math.max(30, boxHeight - 60)}`,
                  isBold: false,
                },
                {
                  color: '#bbbbbb',
                  size: 24,
                  y: `h-${Math.max(30, boxHeight - 90)}`,
                  isBold: false,
                },
              ];

              overlayLines.forEach((line, idx) => {
                const safeText = escapeDrawtext(line.text);
                const cfg =
                  linesConfig[idx] ?? linesConfig[linesConfig.length - 1];

                // Try to use Japanese font, but don't fail if not available
                let fontParam = '';
                try {
                  const fontPath = getJapaneseFontPath(line.isBold);
                  console.log(
                    `[Font Debug Dual] Line ${idx}, isBold: ${line.isBold}, fontPath: ${fontPath}`,
                  );
                  fontParam = `fontfile='${fontPath}':`;
                } catch (e) {
                  console.log('[Font Debug Dual] Error getting font path:', e);
                  fontParam = '';
                }

                const text = `drawtext=${fontParam}text='${safeText}':fontcolor=${cfg.color}:fontsize=${cfg.size}:borderw=0:bordercolor=black@0.0:x=20:y=${cfg.y}`;
                console.log(`[Font Debug Dual] drawtext filter: ${text}`);
                overlayFilters.push(text);
              });

              filterSteps.push(`[vbase]${overlayFilters.join(',')}[vout]`);
            } else {
              filterSteps.push('[vbase]null[vout]');
            }

            const args = [
              ...inputs,
              '-filter_complex',
              filterSteps.join(';'),
              '-map',
              '[vout]',
              '-map',
              audioMap,
              '-c:v',
              'libx264',
              '-preset',
              'veryfast',
              '-c:a',
              'aac',
              outputPath,
            ];
            const ff = spawn(getFfmpegPath(), args);
            ff.stderr.on('data', (data) =>
              console.log('[ffmpeg]', data.toString()),
            );
            ff.on('close', (code) => {
              if (code === 0) resolve();
              else reject(new Error(`ffmpeg exited with code ${code}`));
            });
          });

        const formatLines = (
          clip: (typeof clips)[number],
        ): Array<{ text: string; isBold: boolean }> => {
          const lines: Array<{ text: string; isBold: boolean }> = [];

          // 1行目: #通番 アクション名（太字）
          if (overlay.showActionName) {
            const index = clip.actionIndex ?? 1;
            lines.push({ text: `#${index} ${clip.actionName}`, isBold: true });
          }

          // 2行目: ラベル（グループ名がある場合は「グループ名: ラベル名」形式）
          if (overlay.showLabels && clip.labels && clip.labels.length > 0) {
            const labelText = clip.labels
              .map((l) => (l.group ? `${l.group}: ${l.name}` : l.name))
              .join(', ');
            lines.push({ text: labelText, isBold: false });
          }

          // 3行目: メモ
          if (overlay.showMemo && clip.memo) {
            lines.push({ text: clip.memo, isBold: false });
          }

          return lines;
        };

        const renderClip = async (
          clip: (typeof clips)[number] & {
            annotationPngPrimary?: string | null;
            annotationPngSecondary?: string | null;
            freezeAt?: number | null;
            freezeDuration?: number;
          },
          outputPath?: string,
        ) => {
          const overlayLines = formatLines(clip);
          const target =
            outputPath ||
            path.join(
              os.tmpdir(),
              `clip_${clip.id}_${Date.now()}_${Math.random()}.mp4`,
            );

          let annPrimaryPath: string | null = null;
          let annSecondaryPath: string | null = null;
          if (clip.annotationPngPrimary) {
            annPrimaryPath = await dataUrlToTempFile(
              clip.annotationPngPrimary,
              `anno_p_${clip.id}`,
            );
            tempFiles.push(annPrimaryPath);
          }
          if (clip.annotationPngSecondary) {
            annSecondaryPath = await dataUrlToTempFile(
              clip.annotationPngSecondary,
              `anno_s_${clip.id}`,
            );
            tempFiles.push(annSecondaryPath);
          }

          if (useDual) {
            await runFfmpegDual(
              clip,
              target,
              overlayLines,
              annPrimaryPath,
              annSecondaryPath,
            );
          } else {
            await runFfmpegSingle(clip, target, overlayLines, annPrimaryPath);
          }
          return target;
        };

        const concatFiles = async (files: string[], outputPath: string) => {
          const listPath = path.join(
            os.tmpdir(),
            `concat_${Date.now()}_${Math.random()}.txt`,
          );
          const content = files
            .map((f) => `file '${f.replace(/'/g, "'\\''")}'`)
            .join('\n');
          await fs.writeFile(listPath, content, 'utf-8');
          return new Promise<void>((resolve, reject) => {
            const ff = spawn(getFfmpegPath(), [
              '-y',
              '-f',
              'concat',
              '-safe',
              '0',
              '-i',
              listPath,
              '-fflags',
              '+genpts',
              '-c:v',
              'libx264',
              '-preset',
              'veryfast',
              '-c:a',
              'aac',
              outputPath,
            ]);
            ff.stderr.on('data', (data) =>
              console.log('[ffmpeg]', data.toString()),
            );
            ff.on('close', async (code) => {
              await fs.unlink(listPath).catch(() => undefined);
              if (code === 0) resolve();
              else reject(new Error(`ffmpeg exited with code ${code}`));
            });
          });
        };

        const ensureMp4 = (name: string) =>
          name.toLowerCase().endsWith('.mp4') ? name : `${name}.mp4`;
        const baseName = outputFileName
          ? outputFileName.replace(/\.mp4$/i, '')
          : '';
        const prefix = baseName ? `${baseName}_` : '';

        if (exportMode === 'perInstance') {
          for (const clip of clips) {
            const safeAction = clip.actionName.replace(/\s+/g, '_');
            const baseName = `${safeAction}_${clip.actionIndex ?? 1}_${Math.round(clip.startTime)}-${Math.round(clip.endTime)}${useDual ? '_dual' : ''}`;
            const outName = ensureMp4(`${prefix}${baseName}`);
            const outPath = path.join(targetDir, outName);
            await renderClip(clip, outPath);
          }
        } else if (exportMode === 'perRow') {
          const byAction = new Map<string, (typeof clips)[number][]>();
          clips.forEach((c) => {
            const arr = byAction.get(c.actionName) || [];
            arr.push(c);
            byAction.set(c.actionName, arr);
          });
          for (const [actionName, group] of byAction.entries()) {
            const temps: string[] = [];
            for (const clip of group) {
              temps.push(await renderClip(clip));
            }
            const safeAction = actionName.replace(/\s+/g, '_');
            const baseName = `${safeAction}_row${useDual ? '_dual' : ''}`;
            const outName = ensureMp4(`${prefix}${baseName}`);
            const outPath = path.join(targetDir, outName);
            await concatFiles(temps, outPath);
            await Promise.all(
              temps.map((t) => fs.unlink(t).catch(() => undefined)),
            );
          }
        } else {
          // single連結
          const temps: string[] = [];
          for (const clip of clips) {
            temps.push(await renderClip(clip));
          }
          const defaultName = `combined_${clips.length}${useDual ? '_dual' : ''}.mp4`;
          const outName = outputFileName ? ensureMp4(baseName) : defaultName;
          const outPath = path.join(targetDir, outName);
          await concatFiles(temps, outPath);
          await Promise.all(
            temps.map((t) => fs.unlink(t).catch(() => undefined)),
          );
        }

        await Promise.all(
          tempFiles.map((f: string) => fs.unlink(f).catch(() => undefined)),
        );
        return { success: true };
      } catch (err) {
        console.error('export-clips-with-overlay error', err);
        await Promise.all(
          tempFiles.map((f: string) => fs.unlink(f).catch(() => undefined)),
        );
        return { success: false, error: String(err) };
      }
    },
  );

  return window;
};
Utils();
registerSettingsHandlers();
registerPlaylistHandlers();
registerSettingsWindowHandlers();

/**
 * ファイル拡張子に応じて適切な処理を実行
 */
const handleFileOpen = (filePath: string) => {
  // ウィンドウが準備できていない場合は待機
  if (!mainWindow || mainWindow.isDestroyed()) {
    console.warn('Main window not ready, queueing file open:', filePath);
    return;
  }

  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.stpl' || ext === '.json') {
    // プレイリストファイル
    sendPlaylistFileToWindow(filePath);
  } else if (ext === '.stcw') {
    // コードウィンドウファイル - 設定画面のコードウィンドウタブを開く
    pendingCodeWindowExternalOpen = filePath;
    mainWindow.webContents.send('open-code-window-file', filePath);
  } else if (ext === '.stpkg' || !ext) {
    // パッケージディレクトリ（拡張子なしまたは.stpkg）
    mainWindow.webContents.send('open-package-directory', filePath);
  }
};

app.on('open-file', (event, filePath) => {
  event.preventDefault();
  pendingFile = filePath;
  if (app.isReady() && mainWindow && !mainWindow.isDestroyed()) {
    handleFileOpen(filePath);
  }
});

app.whenReady().then(async () => {
  await createWindow();
  if (pendingFile) {
    handleFileOpen(pendingFile);
    pendingFile = null;
  }
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
