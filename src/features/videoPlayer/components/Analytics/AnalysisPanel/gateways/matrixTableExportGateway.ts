interface MatrixTableExportFilters {
  name: string;
  extensions: string[];
}

type MatrixTableExportContent =
  | {
      kind: 'text';
      content: string;
    }
  | {
      kind: 'base64';
      content: string;
    };

export type MatrixTableExportResult =
  | 'saved'
  | 'cancelled'
  | 'unavailable'
  | 'failed';

const getElectronApi = (): Window['electronAPI'] => {
  return globalThis.window.electronAPI;
};

export const saveMatrixTableExport = async (
  defaultName: string,
  filters: MatrixTableExportFilters[],
  payload: MatrixTableExportContent,
): Promise<MatrixTableExportResult> => {
  const api = getElectronApi();
  if (!api?.saveFileDialog || !api.writeTextFile || !api.writeBinaryFile) {
    return 'unavailable';
  }

  try {
    const filePath = await api.saveFileDialog(defaultName, filters);
    if (!filePath) {
      return 'cancelled';
    }

    const saved =
      payload.kind === 'text'
        ? await api.writeTextFile(filePath, payload.content)
        : await api.writeBinaryFile(filePath, payload.content);

    return saved ? 'saved' : 'failed';
  } catch (error: unknown) {
    console.debug('[matrixTableExportGateway] save failed', error);
    return 'failed';
  }
};
