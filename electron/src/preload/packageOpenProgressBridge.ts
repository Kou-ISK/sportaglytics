import type { IElectronAPI } from '../../../src/renderer';
import { isPackageOpenProgress } from '../../../src/types/package/openProgress';

interface Transport {
  invoke: (channel: string, requestId: string) => Promise<unknown>;
  on: (
    channel: string,
    listener: (event: unknown, payload: unknown) => void,
  ) => unknown;
  removeListener: (
    channel: string,
    listener: (event: unknown, payload: unknown) => void,
  ) => unknown;
}

export const createPackageOpenProgressBridge = (
  ipcRenderer: Transport,
): Pick<IElectronAPI, 'cancelPackageOpen' | 'onPackageOpenProgress'> => ({
  cancelPackageOpen: async (requestId) => {
    const result = await ipcRenderer.invoke('package:cancel-open', requestId);
    if (typeof result !== 'boolean')
      throw new Error('Invalid package cancellation response');
    return result;
  },
  onPackageOpenProgress: (callback) => {
    const listener = (_event: unknown, state: unknown): void => {
      if (isPackageOpenProgress(state)) callback(state);
    };
    ipcRenderer.on('package:open-progress', listener);
    return () => ipcRenderer.removeListener('package:open-progress', listener);
  },
});
