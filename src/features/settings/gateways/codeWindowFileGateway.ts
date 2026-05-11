export interface CodeWindowFileLoadResult {
  codeWindow: unknown;
  filePath: string;
}

const noop = (): void => undefined;

const getElectronApi = (): Window['electronAPI'] => {
  return globalThis.window.electronAPI;
};

export const canUseCodeWindowFileApi = (): boolean => {
  const api = getElectronApi();
  return Boolean(api?.codeWindow?.saveFile && api.codeWindow.loadFile);
};

export const saveCodeWindowFile = async (
  payload: unknown,
  filePath?: string,
): Promise<string | null> => {
  const api = getElectronApi();
  if (!api?.codeWindow?.saveFile) {
    return null;
  }

  try {
    return await api.codeWindow.saveFile(payload, filePath);
  } catch (error: unknown) {
    console.debug('[codeWindowFileGateway] save failed', error);
    return null;
  }
};

export const loadCodeWindowFile = async (
  filePath?: string,
): Promise<CodeWindowFileLoadResult | null> => {
  const api = getElectronApi();
  if (!api?.codeWindow?.loadFile) {
    return null;
  }

  try {
    return await api.codeWindow.loadFile(filePath);
  } catch (error: unknown) {
    console.debug('[codeWindowFileGateway] load failed', error);
    return null;
  }
};

export const subscribeCodeWindowExternalOpen = (
  callback: (filePath: string) => void,
): (() => void) => {
  const api = getElectronApi();
  if (!api?.codeWindow?.onExternalOpen) {
    return noop;
  }

  try {
    return api.codeWindow.onExternalOpen(callback);
  } catch (error: unknown) {
    console.debug(
      '[codeWindowFileGateway] external open subscribe failed',
      error,
    );
    return noop;
  }
};

export const consumeCodeWindowExternalOpen = async (
  expectedPath?: string,
): Promise<string | null> => {
  const api = getElectronApi();
  if (!api?.codeWindow?.consumeExternalOpen) {
    return null;
  }

  try {
    return await api.codeWindow.consumeExternalOpen(expectedPath);
  } catch (error: unknown) {
    console.debug(
      '[codeWindowFileGateway] consume external open failed',
      error,
    );
    return null;
  }
};

export const peekCodeWindowExternalOpen = async (): Promise<string | null> => {
  const api = getElectronApi();
  if (!api?.codeWindow?.peekExternalOpen) {
    return null;
  }

  try {
    return await api.codeWindow.peekExternalOpen();
  } catch (error: unknown) {
    console.debug('[codeWindowFileGateway] peek external open failed', error);
    return null;
  }
};
