import { contextBridge, ipcRenderer } from 'electron';
import type { IElectronAPI } from '../../src/renderer';
import { createAnalysisBridge } from './preload/analysisBridge';
import { createAppBridge } from './preload/appBridge';
import { createCodeWindowBridge } from './preload/codeWindowBridge';
import { createEventBridge } from './preload/eventBridge';
import {
  createListenerStore,
  createRegisterListener,
} from './preload/listenerStore';
import { createPlaylistBridge } from './preload/playlistBridge';
import { createSettingsBridge } from './preload/settingsBridge';

contextBridge.exposeInMainWorld('versions', {
  node: () => process.versions.node,
  chrome: () => process.versions.chrome,
  electron: () => process.versions.electron,
});

const listenerStore = createListenerStore();
const registerListener = createRegisterListener(ipcRenderer, listenerStore);

try {
  ipcRenderer.setMaxListeners(50);
} catch {
  // noop
}

const electronAPI = {
  ...createAppBridge(ipcRenderer),
  ...createEventBridge(registerListener, listenerStore),
  ...createSettingsBridge(ipcRenderer, listenerStore),
  ...createAnalysisBridge(ipcRenderer, listenerStore),
  ...createPlaylistBridge(ipcRenderer, listenerStore),
  ...createCodeWindowBridge(ipcRenderer),
} satisfies IElectronAPI;

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

try {
  ipcRenderer.send('preload:ready');
} catch {
  // noop
}
