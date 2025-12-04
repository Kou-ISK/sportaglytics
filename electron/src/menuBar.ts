import { Menu, app, BrowserWindow } from 'electron';

export const menuBar = Menu.buildFromTemplate([
  {
    label: app.name,
    submenu: [
      { role: 'about', label: `${app.name}について` },
      { type: 'separator' },
      { role: 'services', label: 'サービス' },
      { type: 'separator' },
      { role: 'hide', label: `${app.name}を隠す` },
      { role: 'hideOthers', label: 'ほかを隠す' },
      { role: 'unhide', label: 'すべて表示' },
      { type: 'separator' },
      { role: 'quit', label: `${app.name}を終了` },
    ],
  },
  {
    label: 'ファイル',
    submenu: [{ role: 'close', label: 'ウィンドウを閉じる' }],
  },
  {
    label: '編集',
    submenu: [
      { role: 'undo', label: '元に戻す' },
      { role: 'redo', label: 'やり直す' },
      { type: 'separator' },
      { role: 'cut', label: '切り取り' },
      { role: 'copy', label: 'コピー' },
      { role: 'paste', label: '貼り付け' },
      { role: 'pasteAndMatchStyle', label: 'ペーストしてスタイルを合わせる' },
      { role: 'delete', label: '削除' },
      { role: 'selectAll', label: 'すべてを選択' },
      { type: 'separator' },
      {
        label: 'スピーチ',
        submenu: [
          { role: 'startSpeaking', label: '読み上げを開始' },
          { role: 'stopSpeaking', label: '読み上げを停止' },
        ],
      },
    ],
  },
  {
    label: '書き出し',
    submenu: [
      {
        label: 'クリップ書き出し（オーバーレイ）',
        click: (_menuItem, browserWindow) => {
          if (browserWindow && 'webContents' in browserWindow) {
            (browserWindow as BrowserWindow).webContents.send(
              'menu-export-clips',
            );
          }
        },
      },
    ],
  },
  {
    label: '表示',
    submenu: [
      { role: 'reload', label: '再読み込み' },
      { role: 'forceReload', label: '強制的に再読み込み' },
      { role: 'toggleDevTools', label: '開発者ツールを表示' },
      { type: 'separator' },
      { role: 'resetZoom', label: '実際のサイズ' },
      { role: 'zoomIn', label: '拡大' },
      { role: 'zoomOut', label: '縮小' },
      { type: 'separator' },
      { role: 'togglefullscreen', label: 'フルスクリーン' },
    ],
  },
  {
    label: '映像',
    submenu: [
      {
        label: '音声同期を再実行',
        accelerator: 'CmdOrCtrl+Shift+S',
        click: (menuItem, browserWindow) => {
          if (browserWindow && 'webContents' in browserWindow) {
            (browserWindow as BrowserWindow).webContents.send(
              'menu-resync-audio',
            );
          }
        },
      },
      {
        label: '同期をリセット',
        accelerator: 'CmdOrCtrl+Shift+R',
        click: (menuItem, browserWindow) => {
          if (browserWindow && 'webContents' in browserWindow) {
            (browserWindow as BrowserWindow).webContents.send(
              'menu-reset-sync',
            );
          }
        },
      },
      { type: 'separator' },
      {
        label: '今の位置で同期',
        accelerator: 'CmdOrCtrl+Shift+M',
        click: (menuItem, browserWindow) => {
          if (browserWindow && 'webContents' in browserWindow) {
            (browserWindow as BrowserWindow).webContents.send(
              'menu-manual-sync',
            );
          }
        },
      },
      {
        id: 'toggle-manual-mode',
        type: 'checkbox',
        label: '手動モード（個別シーク許可）',
        checked: false,
        accelerator: 'CmdOrCtrl+Shift+T',
        click: (menuItem, browserWindow) => {
          if (browserWindow && 'webContents' in browserWindow) {
            const mode = menuItem.checked ? 'manual' : 'auto';
            (browserWindow as BrowserWindow).webContents.send(
              'menu-set-sync-mode',
              mode,
            );
          }
        },
      },
    ],
  },
  {
    label: 'タイムライン',
    submenu: [
      {
        label: 'エクスポート',
        submenu: [
          {
            label: 'JSON形式',
            click: (_menuItem, browserWindow) => {
              if (browserWindow && 'webContents' in browserWindow) {
                (browserWindow as BrowserWindow).webContents.send(
                  'menu-export-timeline',
                  'json',
                );
              }
            },
          },
          {
            label: 'CSV形式',
            click: (_menuItem, browserWindow) => {
              if (browserWindow && 'webContents' in browserWindow) {
                (browserWindow as BrowserWindow).webContents.send(
                  'menu-export-timeline',
                  'csv',
                );
              }
            },
          },
          {
            label: 'SCTimeline形式',
            click: (_menuItem, browserWindow) => {
              if (browserWindow && 'webContents' in browserWindow) {
                (browserWindow as BrowserWindow).webContents.send(
                  'menu-export-timeline',
                  'sctimeline',
                );
              }
            },
          },
        ],
      },
      {
        label: 'インポート',
        click: (_menuItem, browserWindow) => {
          if (browserWindow && 'webContents' in browserWindow) {
            (browserWindow as BrowserWindow).webContents.send(
              'menu-import-timeline',
            );
          }
        },
      },
    ],
  },
  {
    label: '分析',
    submenu: [
      {
        label: '分析開始',
        accelerator: 'CmdOrCtrl+Shift+A',
        click: (_menuItem, browserWindow) => {
          if (browserWindow && 'webContents' in browserWindow) {
            (browserWindow as BrowserWindow).webContents.send(
              'general-shortcut-event',
              'analyze',
            );
          }
        },
      },
      { type: 'separator' },
      {
        label: 'ショートカットキー一覧',
        accelerator: 'CmdOrCtrl+/',
        click: (_menuItem, browserWindow) => {
          if (browserWindow && 'webContents' in browserWindow) {
            (browserWindow as BrowserWindow).webContents.send(
              'menu-show-shortcuts',
            );
          }
        },
      },
    ],
  },
  {
    label: '設定',
    submenu: [
      {
        label: '設定を開く',
        accelerator: 'CmdOrCtrl+,',
        click: (_menuItem, browserWindow) => {
          if (browserWindow && 'webContents' in browserWindow) {
            (browserWindow as BrowserWindow).webContents.send(
              'menu-open-settings',
            );
          }
        },
      },
    ],
  },
  {
    label: 'ウィンドウ',
    submenu: [
      { role: 'minimize', label: '最小化' },
      { role: 'zoom', label: 'ズーム' },
      { type: 'separator' },
      { role: 'front', label: 'ウィンドウを手前に表示' },
      { type: 'separator' },
      { role: 'window', label: 'ウィンドウ' },
    ],
  },
]);
