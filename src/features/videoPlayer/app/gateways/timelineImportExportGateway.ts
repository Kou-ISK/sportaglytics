interface TimelineFileFilter {
  name: string;
  extensions: string[];
}

const noop = (): void => undefined;

const getElectronApi = () => globalThis.window.electronAPI;

export const subscribeTimelineExportRequest = (
  callback: (format: string) => void,
): (() => void) => {
  const api = getElectronApi();
  if (!api?.onExportTimeline) {
    return noop;
  }

  try {
    return api.onExportTimeline(callback);
  } catch (error: unknown) {
    console.debug(
      '[TimelineImportExportGateway] onExportTimeline failed',
      error,
    );
    return noop;
  }
};

export const subscribeTimelineImportRequest = (
  callback: () => void,
): (() => void) => {
  const api = getElectronApi();
  if (!api?.onImportTimeline) {
    return noop;
  }

  try {
    return api.onImportTimeline(callback);
  } catch (error: unknown) {
    console.debug(
      '[TimelineImportExportGateway] onImportTimeline failed',
      error,
    );
    return noop;
  }
};

export const requestTimelineExportPath = async (
  defaultPath: string,
  filters: TimelineFileFilter[],
): Promise<string | null> => {
  const api = getElectronApi();
  if (!api?.saveFileDialog) {
    return null;
  }

  try {
    return await api.saveFileDialog(defaultPath, filters);
  } catch (error: unknown) {
    console.debug(
      '[TimelineImportExportGateway] saveFileDialog failed',
      error,
    );
    return null;
  }
};

export const writeTimelineFile = async (
  filePath: string,
  content: string,
): Promise<boolean> => {
  const api = getElectronApi();
  if (!api?.writeTextFile) {
    return false;
  }

  try {
    return await api.writeTextFile(filePath, content);
  } catch (error: unknown) {
    console.debug(
      '[TimelineImportExportGateway] writeTextFile failed',
      error,
    );
    return false;
  }
};

export const requestTimelineImportPath = async (): Promise<string | null> => {
  const api = getElectronApi();
  if (!api?.openFileDialog) {
    return null;
  }

  try {
    return await api.openFileDialog([
      { name: 'タイムライン形式', extensions: ['json', 'SCTimeline'] },
    ]);
  } catch (error: unknown) {
    console.debug(
      '[TimelineImportExportGateway] openFileDialog failed',
      error,
    );
    return null;
  }
};

export const readTimelineFile = async (
  filePath: string,
): Promise<string | null> => {
  const api = getElectronApi();
  if (!api?.readTextFile) {
    return null;
  }

  try {
    return await api.readTextFile(filePath);
  } catch (error: unknown) {
    console.debug('[TimelineImportExportGateway] readTextFile failed', error);
    return null;
  }
};
