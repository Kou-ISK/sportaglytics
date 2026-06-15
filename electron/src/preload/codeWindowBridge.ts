import type { IpcRenderer } from 'electron';
import type { IElectronAPI } from '../../../src/renderer';

type CodeWindowBridgeKeys = 'codeWindow' | 'onPackageDirectoryOpen';

export const createCodeWindowBridge = (
  ipcRenderer: IpcRenderer,
): Pick<IElectronAPI, CodeWindowBridgeKeys> => {
  const codeWindowBridge = {
    codeWindow: {
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
      loadFile: async (
        filePath?: string,
      ): Promise<{ codeWindow: unknown; filePath: string } | null> => {
        return await ipcRenderer.invoke('code-window:load-file', filePath);
      },
      onExternalOpen: (callback: (filePath: string) => void) => {
        const wrapped = (_: unknown, path: string) => callback(path);
        ipcRenderer.on('open-code-window-file', wrapped);
        return () =>
          ipcRenderer.removeListener('open-code-window-file', wrapped);
      },
      peekExternalOpen: async (): Promise<string | null> => {
        return await ipcRenderer.invoke('code-window:peek-external-open');
      },
      consumeExternalOpen: async (
        expectedPath?: string,
      ): Promise<string | null> => {
        return await ipcRenderer.invoke(
          'code-window:consume-external-open',
          expectedPath,
        );
      },
    },
    onPackageDirectoryOpen: (callback: (dirPath: string) => void) => {
      const wrapped = (_: unknown, path: string) => callback(path);
      ipcRenderer.on('open-package-directory', wrapped);
      return () =>
        ipcRenderer.removeListener('open-package-directory', wrapped);
    },
  } satisfies Pick<IElectronAPI, CodeWindowBridgeKeys>;

  return codeWindowBridge;
};
