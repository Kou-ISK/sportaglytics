const toBase64FromDataUrl = (dataUrl: string): string => {
  return dataUrl.split(',')[1] || '';
};

const splitPath = (filePath: string): { base: string; ext: string } => {
  const dotIndex = filePath.lastIndexOf('.');
  if (dotIndex <= 0) {
    return { base: filePath, ext: '' };
  }

  return {
    base: filePath.slice(0, dotIndex),
    ext: filePath.slice(dotIndex),
  };
};

const getAnalysisExportApi = () => globalThis.window.electronAPI;

export const copyAnalysisSummaryToClipboard = async (
  summary: string,
): Promise<boolean> => {
  const clipboard = globalThis.navigator?.clipboard;
  if (!clipboard?.writeText) {
    return false;
  }

  await clipboard.writeText(summary);
  return true;
};

export const canCaptureAnalysisWindowRegion = (): boolean => {
  return Boolean(getAnalysisExportApi()?.captureWindowRegionAsPng);
};

export const captureAnalysisWindowRegionAsPng = async (rect: {
  x: number;
  y: number;
  width: number;
  height: number;
}): Promise<string | null> => {
  const api = getAnalysisExportApi();
  if (!api?.captureWindowRegionAsPng) {
    return null;
  }

  return await api.captureWindowRegionAsPng(rect);
};

export const canExportAnalysisPng = (): boolean => {
  const api = getAnalysisExportApi();
  return Boolean(api?.saveFileDialog && api?.writeBinaryFile);
};

export const exportAnalysisPngParts = async ({
  defaultFileName,
  parts,
}: {
  defaultFileName: string;
  parts: string[];
}): Promise<{ success: boolean; canceled?: boolean; partCount: number }> => {
  const api = getAnalysisExportApi();
  if (!api?.saveFileDialog || !api?.writeBinaryFile) {
    return { success: false, partCount: 0 };
  }

  const filePath = await api.saveFileDialog(defaultFileName, [
    { name: 'PNG', extensions: ['png'] },
  ]);
  if (!filePath) {
    return { success: false, canceled: true, partCount: 0 };
  }

  const { base, ext } = splitPath(filePath);
  for (let i = 0; i < parts.length; i += 1) {
    const targetPath =
      parts.length === 1 ? filePath : `${base}-part${i + 1}${ext || '.png'}`;
    const base64 = toBase64FromDataUrl(parts[i] ?? '');
    if (!base64) {
      return { success: false, partCount: parts.length };
    }

    const saved = await api.writeBinaryFile(targetPath, base64);
    if (!saved) {
      return { success: false, partCount: parts.length };
    }
  }

  return { success: true, partCount: parts.length };
};
