import { buildAnalysisReportData } from '../report/buildAnalysisReportData';
import type { AnalysisReportBuildContext } from '../report/types';

interface ExportAnalysisReportPdfOptions {
  reportContext: AnalysisReportBuildContext;
  defaultFileName?: string;
}

export const exportAnalysisReportPdf = async ({
  reportContext,
  defaultFileName,
}: ExportAnalysisReportPdfOptions): Promise<{
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
  const ok = await api.printAnalysisReportPdf(filePath, reportData);

  return { success: ok };
};
