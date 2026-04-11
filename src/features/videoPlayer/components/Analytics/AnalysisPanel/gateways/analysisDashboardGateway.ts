const DASHBOARD_EXPORT_FILTERS = [
  { name: 'SporTagLytics Dashboard', extensions: ['stad'] },
];

const DASHBOARD_IMPORT_FILTERS = [
  { name: 'SporTagLytics Dashboard', extensions: ['stad', 'json'] },
];

const getAnalysisDashboardApi = () => globalThis.window.electronAPI;

export const canExportAnalysisDashboard = (): boolean => {
  const api = getAnalysisDashboardApi();
  return Boolean(api?.saveFileDialog && api?.saveDashboardPackage);
};

export const canImportAnalysisDashboard = (): boolean => {
  const api = getAnalysisDashboardApi();
  return Boolean(
    api?.openDashboardPackageDialog &&
      (api?.readDashboardPackage || api?.readTextFile),
  );
};

export const requestAnalysisDashboardExportPath = async (
  defaultFileName: string,
): Promise<string | null> => {
  const api = getAnalysisDashboardApi();
  if (!api?.saveFileDialog) {
    return null;
  }

  return await api.saveFileDialog(defaultFileName, DASHBOARD_EXPORT_FILTERS);
};

export const writeAnalysisDashboardPackage = async (
  filePath: string,
  content: string,
): Promise<boolean> => {
  const api = getAnalysisDashboardApi();
  if (!api?.saveDashboardPackage) {
    return false;
  }

  return await api.saveDashboardPackage(filePath, content);
};

export const requestAnalysisDashboardImportPath = async (): Promise<string | null> => {
  const api = getAnalysisDashboardApi();
  if (!api?.openDashboardPackageDialog) {
    return null;
  }

  return await api.openDashboardPackageDialog(DASHBOARD_IMPORT_FILTERS);
};

export const readAnalysisDashboardImportContent = async (
  filePath: string,
): Promise<string | null> => {
  const api = getAnalysisDashboardApi();
  const lowerPath = filePath.toLowerCase();

  if (lowerPath.endsWith('.stad')) {
    if (!api?.readDashboardPackage) {
      return null;
    }
    return await api.readDashboardPackage(filePath);
  }

  if (!api?.readTextFile) {
    return null;
  }

  return await api.readTextFile(filePath);
};
