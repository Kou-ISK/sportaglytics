import { buildAnalysisReportData } from '../../../../../../report/buildAnalysisReportData';
import type { AnalysisReportBuildContext } from '../../../../../../report/types';

interface SaveAnalysisReportPdfOptions {
  reportContext: AnalysisReportBuildContext;
  defaultFileName?: string;
}

export const saveAnalysisReportPdf = async ({
  reportContext,
  defaultFileName,
}: SaveAnalysisReportPdfOptions): Promise<{
  success: boolean;
  canceled?: boolean;
}> => {
  const api = globalThis.window.electronAPI;
  if (!api?.saveFileDialog || !api?.printAnalysisReportPdf) {
    return { success: false };
  }

  const filePath = await api.saveFileDialog(
    defaultFileName ??
      `analysis-report-${new Date().toISOString().slice(0, 10)}.pdf`,
    [{ name: 'PDF', extensions: ['pdf'] }],
  );
  if (!filePath) {
    return { success: false, canceled: true };
  }

  const reportData = buildAnalysisReportData(reportContext);
  const success = await api.printAnalysisReportPdf(filePath, reportData);

  return { success };
};
