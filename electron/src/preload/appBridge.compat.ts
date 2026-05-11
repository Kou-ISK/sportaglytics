import type { IpcRenderer } from 'electron';

const isNoHandlerError = (error: unknown, channel: string): boolean => {
  if (!(error instanceof Error)) return false;
  return error.message.includes(`No handler registered for '${channel}'`);
};

export const invokeWithFallback = async <T>(
  ipcRenderer: IpcRenderer,
  primaryChannel: string,
  legacyChannel: string | null,
  ...args: unknown[]
): Promise<T> => {
  try {
    return (await ipcRenderer.invoke(primaryChannel, ...args)) as T;
  } catch (error) {
    if (!legacyChannel || !isNoHandlerError(error, primaryChannel)) {
      throw error;
    }
    return (await ipcRenderer.invoke(legacyChannel, ...args)) as T;
  }
};
