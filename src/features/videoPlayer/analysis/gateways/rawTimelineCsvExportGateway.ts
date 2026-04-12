interface RawTimelineCsvFilter {
  name: string;
  extensions: string[];
}

export type RawTimelineCsvExportResult =
  | 'saved'
  | 'cancelled'
  | 'unavailable'
  | 'failed';

const getElectronApi = (): Window['electronAPI'] => {
  return globalThis.window.electronAPI;
};

export const saveRawTimelineCsv = async (
  defaultFileName: string,
  filters: RawTimelineCsvFilter[],
  csv: string,
): Promise<RawTimelineCsvExportResult> => {
  const api = getElectronApi();
  if (!api?.saveFileDialog || !api.writeTextFile) {
    return 'unavailable';
  }

  try {
    const filePath = await api.saveFileDialog(defaultFileName, filters);
    if (!filePath) {
      return 'cancelled';
    }

    const saved = await api.writeTextFile(filePath, csv);
    return saved ? 'saved' : 'failed';
  } catch (error: unknown) {
    console.debug('[rawTimelineCsvExportGateway] save failed', error);
    return 'failed';
  }
};

export const subscribeRawTimelineCsvExportRequest = (
  callback: () => void,
): (() => void) => {
  const api = getElectronApi();
  if (!api?.onMenuExportAnalysisRawCsv) {
    return () => undefined;
  }

  try {
    return api.onMenuExportAnalysisRawCsv(callback);
  } catch (error: unknown) {
    console.debug('[rawTimelineCsvExportGateway] subscribe failed', error);
    return () => undefined;
  }
};
