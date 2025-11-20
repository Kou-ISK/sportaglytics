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
    tightViewPath: string,
    wideViewPath: string | null,
    metaData: any,
  ) => {
    try {
      const packageDatas: PackageDatas = await ipcRenderer.invoke(
        'create-package',
        directoryName,
        packageName,
        tightViewPath,
        wideViewPath,
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
  // ウィンドウタイトル更新API
  setWindowTitle: (title: string) => {
    ipcRenderer.send('set-window-title', title);
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
});
