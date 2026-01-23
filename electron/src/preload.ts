import {
  IpcRenderer,
  IpcRendererEvent,
  contextBridge,
  ipcRenderer,
} from 'electron';
import { PackageDatas } from '../../src/renderer';

contextBridge.exposeInMainWorld('versions', {
  node: () => process.versions.node,
  chrome: () => process.versions.chrome,
  electron: () => process.versions.electron,
  // we can also expose variables, not just functions
});

// 元リスナー -> ラップしたリスナーの対応表（チャンネル毎）
const __listenerStore: Map<
  string,
  Map<Function, (...args: unknown[]) => void>
> = new Map();

// 任意: 警告閾値を引き上げ（根本対処は off の修正）
try {
  (
    ipcRenderer as unknown as { setMaxListeners?: (n: number) => void }
  ).setMaxListeners?.(50);
} catch {
  // noop
}

contextBridge.exposeInMainWorld('electronAPI', {
  openFile: async () => {
    try {
      const filePath = await ipcRenderer.invoke('open-file');
      return filePath;
    } catch (error) {
      console.error('Error:', error);
      return null;
    }
  },
  openDirectory: async () => {
    try {
      const filePath = await ipcRenderer.invoke('open-directory');
      return filePath;
    } catch (error) {
      console.error('Error:', error);
      return null;
    }
  },
  exportTimeline: async (filePath: string, source: any) => {
    try {
      await ipcRenderer.invoke('export-timeline', filePath, source);
      console.log('Timeline exported successfully.');
    } catch (error) {
      console.error('Error exporting timeline:', error);
    }
  },
  createPackage: async (
    directoryName: string,
    packageName: string,
    angles: Array<{
      id: string;
      name: string;
      sourcePath: string;
      role?: 'primary' | 'secondary';
    }>,
    metaData: any,
  ) => {
    try {
      const packageDatas: PackageDatas = await ipcRenderer.invoke(
        'create-package',
        directoryName,
        packageName,
        angles,
        metaData,
      );
      return packageDatas;
    } catch (error) {
      console.error('Error creating package:', error);
    }
  },
  saveSyncData: async (
    configPath: string,
    syncData: {
      syncOffset: number;
      isAnalyzed: boolean;
      confidenceScore?: number;
    },
  ) => {
    try {
      return await ipcRenderer.invoke('save-sync-data', configPath, syncData);
    } catch (e) {
      console.error('saveSyncData error:', e);
      return false;
    }
  },
  on: (
    channel: string,
    listener: (event: IpcRendererEvent, ...args: unknown[]) => void,
  ) => {
    const wrapped = (...args: unknown[]) => {
      const [event, ...rest] = args as [IpcRendererEvent, ...unknown[]];
      listener(event, ...rest);
    };

    let map = __listenerStore.get(channel);
    if (!map) {
      map = new Map();
      __listenerStore.set(channel, map);
    }
    map.set(listener, wrapped);
    ipcRenderer.on(channel, wrapped);
  },
  off: (channel: string, listener: (...args: unknown[]) => void) => {
    try {
      const map = __listenerStore.get(channel);
      const wrapped = map?.get(listener as unknown as Function);
      if (wrapped) {
        ipcRenderer.removeListener(channel, wrapped as any);
        map?.delete(listener as unknown as Function);
        if (map && map.size === 0) __listenerStore.delete(channel);
      } else {
        // フォールバック（互換性）
        ipcRenderer.removeListener(channel, listener as any);
      }
    } catch (e) {
      console.warn('ipcRenderer.removeListener error', e);
    }
  },
  // メニューからの音声同期イベント
  onResyncAudio: (callback: () => void) => {
    try {
      ipcRenderer.removeAllListeners('menu-resync-audio');
    } catch (e) {
      // ignore
    }
    ipcRenderer.on(
      'menu-resync-audio',
      callback as unknown as (event: IpcRendererEvent) => void,
    );
  },
  onResetSync: (callback: () => void) => {
    try {
      ipcRenderer.removeAllListeners('menu-reset-sync');
    } catch (e) {
      // ignore
    }
    ipcRenderer.on(
      'menu-reset-sync',
      callback as unknown as (event: IpcRendererEvent) => void,
    );
  },
  onManualSync: (callback: () => void) => {
    try {
      ipcRenderer.removeAllListeners('menu-manual-sync');
    } catch (e) {
      // ignore
    }
    ipcRenderer.on(
      'menu-manual-sync',
      callback as unknown as (event: IpcRendererEvent) => void,
    );
  },
  offManualSync: (callback: () => void) => {
    try {
      ipcRenderer.removeListener(
        'menu-manual-sync',
        callback as unknown as (event: IpcRendererEvent) => void,
      );
    } catch {
      /* noop */
    }
  },
  onSetSyncMode: (callback: (mode: 'auto' | 'manual') => void) => {
    try {
      ipcRenderer.removeAllListeners('menu-set-sync-mode');
    } catch (e) {
      // ignore
    }
    ipcRenderer.on('menu-set-sync-mode', (_event, mode: 'auto' | 'manual') =>
      callback(mode),
    );
  },
  offSetSyncMode: (callback: (mode: 'auto' | 'manual') => void) => {
    try {
      ipcRenderer.removeListener(
        'menu-set-sync-mode',
        callback as unknown as (
          event: IpcRendererEvent,
          mode: 'auto' | 'manual',
        ) => void,
      );
    } catch {
      /* noop */
    }
  },
  // 追加: まとめてクリアするAPI（必要なら使用）
  clearMenuSyncListeners: () => {
    try {
      ipcRenderer.removeAllListeners('menu-resync-audio');
      ipcRenderer.removeAllListeners('menu-reset-sync');
      ipcRenderer.removeAllListeners('menu-adjust-sync-offset');
    } catch (e) {
      // ignore
    }
  },
  // ファイル存在確認
  checkFileExists: async (filePath: string) => {
    try {
      const exists = await ipcRenderer.invoke('check-file-exists', filePath);
      return exists;
    } catch (error) {
      console.error('Error checking file:', error);
      return false;
    }
  },
  // JSONファイル読み込み
  readJsonFile: async (filePath: string) => {
    try {
      return await ipcRenderer.invoke('read-json-file', filePath);
    } catch (error) {
      console.error('Error reading JSON file:', error);
      throw error;
    }
  },
  setManualModeChecked: async (checked: boolean) => {
    try {
      return await ipcRenderer.invoke('set-manual-mode-checked', checked);
    } catch (e) {
      console.error('setManualModeChecked error:', e);
      return false;
    }
  },
  setLabelModeChecked: async (checked: boolean) => {
    try {
      return await ipcRenderer.invoke('set-label-mode-checked', checked);
    } catch (e) {
      console.error('setLabelModeChecked error:', e);
      return false;
    }
  },
  onToggleLabelMode: (callback: (checked: boolean) => void) => {
    try {
      ipcRenderer.removeAllListeners('menu-toggle-label-mode');
    } catch (e) {
      // ignore
    }
    ipcRenderer.on('menu-toggle-label-mode', (_event, checked: boolean) =>
      callback(checked),
    );
  },
  // 既存のconfig.jsonを相対パスに変換
  convertConfigToRelativePath: async (packagePath: string) => {
    try {
      return await ipcRenderer.invoke(
        'convert-config-to-relative-path',
        packagePath,
      );
    } catch (e) {
      console.error('convertConfigToRelativePath error:', e);
      return { success: false, error: String(e) };
    }
  },
  // 設定管理API
  loadSettings: async () => {
    try {
      return await ipcRenderer.invoke('settings:load');
    } catch (error) {
      console.error('Error loading settings:', error);
      throw error;
    }
  },
  saveSettings: async (settings: unknown) => {
    try {
      return await ipcRenderer.invoke('settings:save', settings);
    } catch (error) {
      console.error('Error saving settings:', error);
      return false;
    }
  },
  send: (channel: string) => {
    ipcRenderer.send(channel);
  },
  resetSettings: async () => {
    try {
      return await ipcRenderer.invoke('settings:reset');
    } catch (error) {
      console.error('Error resetting settings:', error);
      throw error;
    }
  },
  onSettingsUpdated: (
    callback: (settings: unknown) => void,
  ): (() => void) | void => {
    const wrapped = (_event: IpcRendererEvent, payload: unknown) =>
      callback(payload);
    ipcRenderer.on('settings:updated', wrapped);
    return () => ipcRenderer.removeListener('settings:updated', wrapped);
  },
  onOpenSettings: (callback: () => void) => {
    try {
      ipcRenderer.removeAllListeners('menu-open-settings');
    } catch (e) {
      console.warn('Failed to remove listeners:', e);
    }
    ipcRenderer.on(
      'menu-open-settings',
      callback as unknown as (event: IpcRendererEvent) => void,
    );
  },
  offOpenSettings: (callback: () => void) => {
    try {
      ipcRenderer.removeListener(
        'menu-open-settings',
        callback as unknown as (event: IpcRendererEvent) => void,
      );
    } catch {
      /* noop */
    }
  },
  openSettingsWindow: async () => {
    try {
      await ipcRenderer.invoke('settings:open-window');
    } catch (error) {
      console.error('Error opening settings window:', error);
    }
  },
  closeSettingsWindow: async () => {
    try {
      await ipcRenderer.invoke('settings:close-window');
    } catch (error) {
      console.error('Error closing settings window:', error);
    }
  },
  isSettingsWindowOpen: async () => {
    try {
      return await ipcRenderer.invoke('settings:is-window-open');
    } catch (error) {
      console.error('Error checking settings window state:', error);
      return false;
    }
  },
  // 分析ウィンドウAPI
  analysis: {
    openWindow: async () => {
      try {
        await ipcRenderer.invoke('analysis:open-window');
      } catch (error) {
        console.error('Error opening analysis window:', error);
      }
    },
    closeWindow: async () => {
      try {
        await ipcRenderer.invoke('analysis:close-window');
      } catch (error) {
        console.error('Error closing analysis window:', error);
      }
    },
    isWindowOpen: async () => {
      try {
        return await ipcRenderer.invoke('analysis:is-window-open');
      } catch (error) {
        console.error('Error checking analysis window state:', error);
        return false;
      }
    },
    syncToWindow: (data: unknown) => {
      ipcRenderer.send('analysis:sync-to-window', data);
    },
    onSync: (callback: (data: unknown) => void) => {
      const wrapped = (_event: IpcRendererEvent, data: unknown) => {
        callback(data);
      };
      let map = __listenerStore.get('analysis:sync');
      if (!map) {
        map = new Map();
        __listenerStore.set('analysis:sync', map);
      }
      map.set(
        callback as unknown as Function,
        wrapped as unknown as (...args: unknown[]) => void,
      );
      ipcRenderer.on('analysis:sync', wrapped);
    },
    offSync: (callback: (data: unknown) => void) => {
      const map = __listenerStore.get('analysis:sync');
      const wrapped = map?.get(callback as unknown as Function);
      if (wrapped) {
        ipcRenderer.removeListener(
          'analysis:sync',
          wrapped as unknown as (...args: unknown[]) => void,
        );
        map?.delete(callback as unknown as Function);
      }
    },
    sendJumpToSegment: (segment: unknown) => {
      ipcRenderer.send('analysis:jump-to-segment', segment);
    },
  },
  // ウィンドウタイトル更新API
  setWindowTitle: (title: string) => {
    ipcRenderer.send('set-window-title', title);
  },
  exportClipsWithOverlay: async (payload: unknown) => {
    try {
      return await ipcRenderer.invoke('export-clips-with-overlay', payload);
    } catch (error) {
      console.error('Error exportClipsWithOverlay:', error);
      return { success: false, error: String(error) };
    }
  },
  // タイムラインエクスポート/インポート用API
  saveFileDialog: async (
    defaultPath: string,
    filters: { name: string; extensions: string[] }[],
  ) => {
    try {
      return await ipcRenderer.invoke('save-file-dialog', defaultPath, filters);
    } catch (error) {
      console.error('Error in saveFileDialog:', error);
      return null;
    }
  },
  openFileDialog: async (filters: { name: string; extensions: string[] }[]) => {
    try {
      return await ipcRenderer.invoke('open-file-dialog', filters);
    } catch (error) {
      console.error('Error in openFileDialog:', error);
      return null;
    }
  },
  writeTextFile: async (filePath: string, content: string) => {
    try {
      return await ipcRenderer.invoke('write-text-file', filePath, content);
    } catch (error) {
      console.error('Error in writeTextFile:', error);
      return false;
    }
  },
  readTextFile: async (filePath: string) => {
    try {
      return await ipcRenderer.invoke('read-text-file', filePath);
    } catch (error) {
      console.error('Error in readTextFile:', error);
      return null;
    }
  },
  onExportTimeline: (callback: (format: string) => void) => {
    try {
      ipcRenderer.removeAllListeners('menu-export-timeline');
    } catch (e) {
      // ignore
    }
    ipcRenderer.on('menu-export-timeline', (_event, format: string) => {
      callback(format);
    });
  },
  onImportTimeline: (callback: () => void) => {
    try {
      ipcRenderer.removeAllListeners('menu-import-timeline');
    } catch (e) {
      // ignore
    }
    ipcRenderer.on(
      'menu-import-timeline',
      callback as unknown as (event: IpcRendererEvent) => void,
    );
  },
  onCodingModeChange: (callback: (mode: 'code' | 'label') => void) => {
    try {
      ipcRenderer.removeAllListeners('menu-coding-mode');
    } catch {
      // ignore
    }
    ipcRenderer.on('menu-coding-mode', (_event, mode: 'code' | 'label') =>
      callback(mode),
    );
  },
  onOpenPackage: (callback: () => void) => {
    try {
      ipcRenderer.removeAllListeners('menu-open-package');
    } catch {
      // ignore
    }
    ipcRenderer.on('menu-open-package', callback as unknown as () => void);
  },
  onOpenRecentPackage: (callback: (path: string) => void) => {
    try {
      ipcRenderer.removeAllListeners('menu-open-recent-package');
    } catch {
      // ignore
    }
    ipcRenderer.on('menu-open-recent-package', (_e, path: string) =>
      callback(path),
    );
  },
  updateRecentPackages: (paths: string[]) => {
    ipcRenderer.send('recent-packages:update', paths);
  },

  // プレイリストAPI
  playlist: {
    /** プレイリストウィンドウを開く */
    openWindow: async () => {
      await ipcRenderer.invoke('playlist:open-window');
    },
    /** プレイリストウィンドウを閉じる */
    closeWindow: async () => {
      await ipcRenderer.invoke('playlist:close-window');
    },
    /** プレイリストウィンドウが開いているか確認 */
    isWindowOpen: async (): Promise<boolean> => {
      return await ipcRenderer.invoke('playlist:is-window-open');
    },
    /** プレイリストウィンドウへ状態を同期 */
    syncToWindow: (data: unknown) => {
      ipcRenderer.send('playlist:sync-to-window', data);
    },
    /** プレイリストウィンドウからのコマンドを受信 */
    onCommand: (callback: (command: unknown) => void) => {
      const wrapped = (_event: IpcRendererEvent, command: unknown) => {
        callback(command);
      };
      let map = __listenerStore.get('playlist:command');
      if (!map) {
        map = new Map();
        __listenerStore.set('playlist:command', map);
      }
      map.set(
        callback as unknown as Function,
        wrapped as unknown as (...args: unknown[]) => void,
      );
      ipcRenderer.on('playlist:command', wrapped);
    },
    /** プレイリストウィンドウからのコマンド受信解除 */
    offCommand: (callback: (command: unknown) => void) => {
      const map = __listenerStore.get('playlist:command');
      const wrapped = map?.get(callback as unknown as Function);
      if (wrapped) {
        ipcRenderer.removeListener(
          'playlist:command',
          wrapped as unknown as (...args: unknown[]) => void,
        );
        map?.delete(callback as unknown as Function);
      }
    },
    /** プレイリストウィンドウ閉じられた通知を受信 */
    onWindowClosed: (callback: () => void) => {
      const wrapped = () => callback();
      let map = __listenerStore.get('playlist:window-closed');
      if (!map) {
        map = new Map();
        __listenerStore.set('playlist:window-closed', map);
      }
      map.set(callback as unknown as Function, wrapped);
      ipcRenderer.on('playlist:window-closed', wrapped);
    },
    /** プレイリストウィンドウ閉じられた通知受信解除 */
    offWindowClosed: (callback: () => void) => {
      const map = __listenerStore.get('playlist:window-closed');
      const wrapped = map?.get(callback as unknown as Function);
      if (wrapped) {
        ipcRenderer.removeListener(
          'playlist:window-closed',
          wrapped as unknown as (...args: unknown[]) => void,
        );
        map?.delete(callback as unknown as Function);
      }
    },

    // プレイリストウィンドウ側専用API
    /** 状態同期を受信（プレイリストウィンドウ側） */
    onSync: (callback: (data: unknown) => void) => {
      const wrapped = (_event: IpcRendererEvent, data: unknown) => {
        callback(data);
      };
      let map = __listenerStore.get('playlist:sync');
      if (!map) {
        map = new Map();
        __listenerStore.set('playlist:sync', map);
      }
      map.set(
        callback as unknown as Function,
        wrapped as unknown as (...args: unknown[]) => void,
      );
      ipcRenderer.on('playlist:sync', wrapped);
    },
    /** 状態同期受信解除 */
    offSync: (callback: (data: unknown) => void) => {
      const map = __listenerStore.get('playlist:sync');
      const wrapped = map?.get(callback as unknown as Function);
      if (wrapped) {
        ipcRenderer.removeListener(
          'playlist:sync',
          wrapped as unknown as (...args: unknown[]) => void,
        );
        map?.delete(callback as unknown as Function);
      }
    },
    /** コマンドを送信（プレイリストウィンドウ側からメインへ） */
    sendCommand: (command: unknown) => {
      ipcRenderer.send('playlist:command', command);
    },

    // ファイル操作API
    /** プレイリストをファイルに保存（上書き保存） */
    savePlaylistFile: async (playlist: unknown): Promise<string | null> => {
      return await ipcRenderer.invoke('playlist:save-file', playlist);
    },
    /** プレイリストを名前を付けて保存 */
    savePlaylistFileAs: async (playlist: unknown): Promise<string | null> => {
      return await ipcRenderer.invoke('playlist:save-file-as', playlist);
    },
    /** プレイリストファイルを読み込み */
    loadPlaylistFile: async (
      filePath?: string,
    ): Promise<{ playlist: unknown; filePath: string } | null> => {
      return await ipcRenderer.invoke('playlist:load-file', filePath);
    },
    /** システム関連付けから開かれたプレイリスト通知 */
    onExternalOpen: (callback: (filePath: string) => void) => {
      const wrapped = (_: unknown, path: string) => callback(path);
      ipcRenderer.on('playlist:external-open', wrapped);
      return () =>
        ipcRenderer.removeListener('playlist:external-open', wrapped);
    },
    /** 保存進行状況の通知を受け取る */
    onSaveProgress: (
      callback: (data: { current: number; total: number }) => void,
    ) => {
      const wrapped = (_: unknown, data: { current: number; total: number }) =>
        callback(data);
      ipcRenderer.on('playlist:save-progress', wrapped);
      return () =>
        ipcRenderer.removeListener('playlist:save-progress', wrapped);
    },

    /** 複数ウィンドウ管理 */
    /** 開いているプレイリストウィンドウの数を取得 */
    getOpenWindowCount: async (): Promise<number> => {
      return await ipcRenderer.invoke('playlist:get-open-count');
    },
    /** 全てのプレイリストウィンドウにアイテムを追加 */
    addItemToAllWindows: async (item: unknown): Promise<void> => {
      await ipcRenderer.invoke('playlist:add-item-to-all-windows', item);
    },
    /** アイテム追加の通知を受信（プレイリストウィンドウ側） */
    onAddItem: (callback: (item: unknown) => void) => {
      const wrapped = (_event: IpcRendererEvent, item: unknown) => {
        callback(item);
      };
      let map = __listenerStore.get('playlist:add-item');
      if (!map) {
        map = new Map();
        __listenerStore.set('playlist:add-item', map);
      }
      map.set(
        callback as unknown as Function,
        wrapped as unknown as (...args: unknown[]) => void,
      );
      ipcRenderer.on('playlist:add-item', wrapped);
    },
    /** アイテム追加の通知受信解除 */
    offAddItem: (callback: (item: unknown) => void) => {
      const map = __listenerStore.get('playlist:add-item');
      const wrapped = map?.get(callback as unknown as Function);
      if (wrapped) {
        ipcRenderer.removeListener(
          'playlist:add-item',
          wrapped as unknown as (...args: unknown[]) => void,
        );
        map?.delete(callback as unknown as Function);
      }
    },
    /** ウィンドウタイトルを設定（プレイリストウィンドウ側） */
    setWindowTitle: (title: string) => {
      ipcRenderer.send('playlist:set-window-title', title);
    },
  },

  /** コードウィンドウファイル操作 */
  codeWindow: {
    /** .stcw ファイルに保存 */
    saveFile: async (
      codeWindow: unknown,
      filePath?: string,
    ): Promise<string | null> => {
      return await ipcRenderer.invoke(
        'code-window:save-file',
        codeWindow,
        filePath,
      );
    },
    /** .stcw ファイルから読み込み */
    loadFile: async (
      filePath?: string,
    ): Promise<{ codeWindow: unknown; filePath: string } | null> => {
      return await ipcRenderer.invoke('code-window:load-file', filePath);
    },
    /** システム関連付けから開かれたコードウィンドウファイル通知 */
    onExternalOpen: (callback: (filePath: string) => void) => {
      const wrapped = (_: unknown, path: string) => callback(path);
      ipcRenderer.on('open-code-window-file', wrapped);
      return () => ipcRenderer.removeListener('open-code-window-file', wrapped);
    },
    /** 外部オープンの待機状態を参照（クリアしない） */
    peekExternalOpen: async (): Promise<string | null> => {
      return await ipcRenderer.invoke('code-window:peek-external-open');
    },
    /** 外部オープンの待機状態を消費（必要なら一致確認） */
    consumeExternalOpen: async (
      expectedPath?: string,
    ): Promise<string | null> => {
      return await ipcRenderer.invoke(
        'code-window:consume-external-open',
        expectedPath,
      );
    },
  },

  /** パッケージディレクトリが外部から開かれたときの通知 */
  onPackageDirectoryOpen: (callback: (dirPath: string) => void) => {
    const wrapped = (_: unknown, path: string) => callback(path);
    ipcRenderer.on('open-package-directory', wrapped);
    return () => ipcRenderer.removeListener('open-package-directory', wrapped);
  },
});
