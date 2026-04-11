import type { IpcRenderer } from 'electron';
import type { IElectronAPI } from '../../../src/renderer';
import {
  createAppBridgeLegacyApi,
  type AppBridgeLegacyKeys,
} from './appBridgeLegacyApi';
import { createAppBridgeFsApi, type AppBridgeFsKeys } from './appBridgeFsApi';
import {
  createAppBridgeMenuApi,
  type AppBridgeMenuKeys,
} from './appBridgeMenuApi';
import type { RegisterListener } from './listenerStore';

type AppBridgeKeys = AppBridgeLegacyKeys | AppBridgeFsKeys | AppBridgeMenuKeys;

export const createAppBridge = (
  ipcRenderer: IpcRenderer,
  registerListener: RegisterListener,
): Pick<IElectronAPI, AppBridgeKeys> => {
  return {
    ...createAppBridgeLegacyApi(ipcRenderer),
    ...createAppBridgeFsApi(ipcRenderer),
    ...createAppBridgeMenuApi(ipcRenderer, registerListener),
  } satisfies Pick<IElectronAPI, AppBridgeKeys>;
};
