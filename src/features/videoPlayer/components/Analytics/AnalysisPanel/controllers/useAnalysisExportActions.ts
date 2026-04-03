import { useCallback, useMemo, useState } from 'react';
import type { RefObject } from 'react';
import type { TimelineData } from '../../../../../../types/TimelineData';
import type { AnalysisView } from '../../../../../../types/AnalysisView';
import type { MatrixAxisConfig } from '../../../../../../types/MatrixConfig';
import type { DashboardSeriesFilter } from '../../../../../../types/Settings';
import type { MatrixFilterState } from './matrixFilterUtils';
import type { NotificationContextValue } from '../../../../../../contexts/NotificationContext';
import { buildAnalysisSummaryText } from '../../../../../../utils/analysisExport';
import {
  captureScrollableContent,
  stitchCapturedSlicesIntoParts,
  withExportLayoutOverrides,
} from '../../../../../../utils/fullContentCapture';
import { saveAnalysisReportPdf } from '../gateways/analysisReportPdfGateway';

const MAX_PNG_PART_HEIGHT = 15000;

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

interface UseAnalysisExportActionsParams {
  currentView: AnalysisView;
  timeline: TimelineData[];
  resolvedTeamNames: string[];
  dashboardFilters: DashboardSeriesFilter;
  matrixAxes: {
    row: MatrixAxisConfig;
    column: MatrixAxisConfig;
  };
  matrixFilters: MatrixFilterState;
  analysisDashboard:
    | import('../../../../../../types/Settings').AnalysisDashboardConfig
    | undefined;
  notification: NotificationContextValue;
  exportTargetRef: RefObject<HTMLDivElement | null>;
}

interface AnalysisExportActions {
  exportAnchor: HTMLElement | null;
  setExportAnchor: (anchor: HTMLElement | null) => void;
  isExporting: boolean;
  closeExportMenu: () => void;
  handleCopySummary: () => Promise<void>;
  handleExportPng: () => Promise<void>;
  handleExportPdf: () => Promise<void>;
}

export const useAnalysisExportActions = ({
  currentView,
  timeline,
  resolvedTeamNames,
  dashboardFilters,
  matrixAxes,
  matrixFilters,
  analysisDashboard,
  notification,
  exportTargetRef,
}: UseAnalysisExportActionsParams): AnalysisExportActions => {
  const [exportAnchor, setExportAnchor] = useState<HTMLElement | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const summaryForClipboard = useMemo(
    () =>
      buildAnalysisSummaryText({
        view: currentView,
        timeline,
        teamNames: resolvedTeamNames,
      }),
    [currentView, timeline, resolvedTeamNames],
  );

  const closeExportMenu = (): void => {
    setExportAnchor(null);
  };

  const captureCurrentViewPngParts = useCallback(async (): Promise<
    string[] | null
  > => {
    const api = window.electronAPI;
    const rootTarget = exportTargetRef.current;

    if (!rootTarget) {
      notification.error('スナップショット対象が見つかりません。');
      return null;
    }

    if (!api?.captureWindowRegionAsPng) {
      notification.error('画面キャプチャ機能が利用できません。');
      return null;
    }

    const horizontalMode = currentView === 'matrix' ? 'auto' : 'off';
    const target =
      currentView === 'matrix'
        ? rootTarget.querySelector<HTMLElement>('.MuiTableContainer-root') ||
          rootTarget
        : rootTarget;

    try {
      const slices = await withExportLayoutOverrides(target, async () => {
        return captureScrollableContent(
          target,
          (rect) => api.captureWindowRegionAsPng(rect),
          { horizontal: horizontalMode },
        );
      });

      if (slices.length === 0) {
        notification.error('キャプチャ対象のコンテンツがありません。');
        return null;
      }

      const parts = await stitchCapturedSlicesIntoParts(
        slices,
        MAX_PNG_PART_HEIGHT,
      );
      if (parts.length === 0) {
        notification.error('画像の連結に失敗しました。');
        return null;
      }
      return parts;
    } catch (error) {
      console.error('Failed to capture full content:', error);
      notification.error('全内容キャプチャに失敗しました。');
      return null;
    }
  }, [notification, currentView, exportTargetRef]);

  const handleCopySummary = useCallback(async (): Promise<void> => {
    closeExportMenu();
    const summary = summaryForClipboard;

    const writeByNavigator = async (): Promise<boolean> => {
      if (!navigator?.clipboard?.writeText) return false;
      await navigator.clipboard.writeText(summary);
      return true;
    };

    const writeByTextarea = (): boolean => {
      const textarea = document.createElement('textarea');
      textarea.value = summary;
      textarea.setAttribute('readonly', 'true');
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(textarea);
      return ok;
    };

    try {
      const ok = (await writeByNavigator()) || writeByTextarea();
      if (ok) {
        notification.success(
          '構造化サマリーをクリップボードにコピーしました。',
        );
      } else {
        notification.error('クリップボードへのコピーに失敗しました。');
      }
    } catch (error) {
      console.error('Failed to copy summary:', error);
      notification.error('クリップボードへのコピーに失敗しました。');
    }
  }, [notification, summaryForClipboard]);

  const handleExportPng = useCallback(async (): Promise<void> => {
    closeExportMenu();

    const api = window.electronAPI;
    if (!api?.saveFileDialog || !api?.writeBinaryFile) {
      notification.error('PNGエクスポート機能が利用できません。');
      return;
    }

    const filePath = await api.saveFileDialog(
      `analysis-${currentView}-${new Date().toISOString().slice(0, 10)}.png`,
      [{ name: 'PNG', extensions: ['png'] }],
    );
    if (!filePath) return;

    setIsExporting(true);
    try {
      const parts = await captureCurrentViewPngParts();
      if (!parts || parts.length === 0) return;

      const { base, ext } = splitPath(filePath);
      let allSaved = true;

      for (let i = 0; i < parts.length; i += 1) {
        const targetPath =
          parts.length === 1
            ? filePath
            : `${base}-part${i + 1}${ext || '.png'}`;
        const base64 = toBase64FromDataUrl(parts[i] ?? '');
        if (!base64) {
          allSaved = false;
          break;
        }
        const ok = await api.writeBinaryFile(targetPath, base64);
        if (!ok) {
          allSaved = false;
          break;
        }
      }

      if (allSaved) {
        if (parts.length === 1) {
          notification.success('PNGを保存しました。');
        } else {
          notification.success(
            `PNGを分割保存しました（${parts.length}ファイル）。`,
          );
        }
      } else {
        notification.error('PNG保存に失敗しました。');
      }
    } finally {
      setIsExporting(false);
    }
  }, [captureCurrentViewPngParts, currentView, notification]);

  const handleExportPdf = useCallback(async (): Promise<void> => {
    closeExportMenu();

    const api = window.electronAPI;
    if (!api?.saveFileDialog || !api?.printAnalysisReportPdf) {
      notification.error('PDFエクスポート機能が利用できません。');
      return;
    }

    setIsExporting(true);
    try {
      const result = await saveAnalysisReportPdf({
        defaultFileName: `analysis-report-${new Date().toISOString().slice(0, 10)}.pdf`,
        reportContext: {
          timeline,
          resolvedTeamNames,
          currentDashboardFilters: dashboardFilters,
          currentMatrixAxes: matrixAxes,
          currentMatrixFilters: matrixFilters,
          analysisDashboard,
        },
      });

      if (result.canceled) return;
      if (result.success) {
        notification.success('PDFを保存しました。');
      } else {
        notification.error('PDF保存に失敗しました。');
      }
    } catch (error) {
      console.error('Failed to export analysis report PDF:', error);
      notification.error('PDFエクスポートに失敗しました。');
    } finally {
      setIsExporting(false);
    }
  }, [
    timeline,
    resolvedTeamNames,
    dashboardFilters,
    matrixAxes,
    matrixFilters,
    analysisDashboard,
    notification,
  ]);

  return {
    exportAnchor,
    setExportAnchor,
    isExporting,
    closeExportMenu,
    handleCopySummary,
    handleExportPng,
    handleExportPdf,
  };
};
