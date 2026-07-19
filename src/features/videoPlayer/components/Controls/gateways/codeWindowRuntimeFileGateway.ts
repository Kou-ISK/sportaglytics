import type { CodeWindowLayout } from '../../../../../types/settings/coreTypes';

type CodeWindowFilePayload = {
  version: number;
  layout: CodeWindowLayout;
};

export interface RuntimeCodeWindowFile {
  layout: CodeWindowLayout;
  filePath: string;
}

const getCodeWindowApi = () => globalThis.window.electronAPI?.codeWindow;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const isCodeWindowFilePayload = (
  value: unknown,
): value is CodeWindowFilePayload => {
  return (
    isRecord(value) &&
    value.version === 1 &&
    isRecord(value.layout) &&
    typeof value.layout.id === 'string' &&
    typeof value.layout.name === 'string' &&
    typeof value.layout.canvasWidth === 'number' &&
    typeof value.layout.canvasHeight === 'number' &&
    Array.isArray(value.layout.buttons)
  );
};

export const loadRuntimeCodeWindowFile = async (
  filePath: string,
): Promise<RuntimeCodeWindowFile | null> => {
  const api = getCodeWindowApi();
  if (!api?.loadFile) {
    return null;
  }

  try {
    const result = await api.loadFile(filePath);
    if (!result || !isCodeWindowFilePayload(result.codeWindow)) {
      return null;
    }
    return {
      layout: result.codeWindow.layout,
      filePath: result.filePath,
    };
  } catch (error: unknown) {
    console.debug('[codeWindowRuntimeFileGateway] load failed', error);
    return null;
  }
};

export const chooseRuntimeCodeWindowFile =
  async (): Promise<RuntimeCodeWindowFile | null> => {
    const api = getCodeWindowApi();
    if (!api?.loadFile) {
      return null;
    }

    try {
      const result = await api.loadFile();
      if (!result || !isCodeWindowFilePayload(result.codeWindow)) {
        return null;
      }
      return {
        layout: result.codeWindow.layout,
        filePath: result.filePath,
      };
    } catch (error: unknown) {
      console.debug('[codeWindowRuntimeFileGateway] choose failed', error);
      return null;
    }
  };

export const saveRuntimeCodeWindowFile = async (
  layout: CodeWindowLayout,
  filePath?: string,
): Promise<string | null> => {
  const api = getCodeWindowApi();
  if (!api?.saveFile) {
    return null;
  }

  try {
    return await api.saveFile(
      {
        version: 1,
        layout,
      },
      filePath,
    );
  } catch (error: unknown) {
    console.debug('[codeWindowRuntimeFileGateway] save failed', error);
    return null;
  }
};

export const subscribeRuntimeCodeWindowExternalOpen = (
  callback: (filePath: string) => void,
): (() => void) => {
  const api = getCodeWindowApi();
  if (!api?.onExternalOpen) {
    return () => undefined;
  }

  try {
    return api.onExternalOpen(callback);
  } catch (error: unknown) {
    console.debug(
      '[codeWindowRuntimeFileGateway] external open subscribe failed',
      error,
    );
    return () => undefined;
  }
};

export const subscribeRuntimeCodeWindowMenuOpen = (
  callback: () => void,
): (() => void) => {
  const api = globalThis.window.electronAPI;
  if (!api?.onOpenCodeWindowFile) {
    return () => undefined;
  }

  try {
    return api.onOpenCodeWindowFile(callback);
  } catch (error: unknown) {
    console.debug(
      '[codeWindowRuntimeFileGateway] menu subscribe failed',
      error,
    );
    return () => undefined;
  }
};

export const consumeRuntimeCodeWindowExternalOpen = async (
  expectedPath?: string,
): Promise<string | null> => {
  const api = getCodeWindowApi();
  if (!api?.consumeExternalOpen) {
    return null;
  }

  try {
    return await api.consumeExternalOpen(expectedPath);
  } catch (error: unknown) {
    console.debug('[codeWindowRuntimeFileGateway] consume failed', error);
    return null;
  }
};
