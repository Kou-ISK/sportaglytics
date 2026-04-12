import { useCallback, useEffect } from 'react';
import type { AnalysisDashboard } from '../../../../../../types/settings/coreTypes';
import type { NotificationContextValue } from '../../../../../../contexts/NotificationContext';
import { subscribeAnalysisDashboardExternalOpen } from '../../../../app/gateways/analysisWindowGateway';
import {
  canExportAnalysisDashboard,
  canImportAnalysisDashboard,
  readAnalysisDashboardImportContent,
  requestAnalysisDashboardExportPath,
  requestAnalysisDashboardImportPath,
  writeAnalysisDashboardPackage,
} from '../gateways/analysisDashboardGateway';
import {
  buildAnalysisDashboardExportContent,
  parseAnalysisDashboardImportContent,
} from '../utils/analysisDashboardImportExportService';
import { generateDashboardId } from './dashboardTabController.utils';

interface UseDashboardImportExportParams {
  activeDashboard?: AnalysisDashboard;
  dashboards: AnalysisDashboard[];
  notification: NotificationContextValue;
  saveDashboards: (
    nextDashboards: AnalysisDashboard[],
    nextActiveId: string,
  ) => Promise<void>;
}

interface DashboardImportExportActions {
  handleExportDashboard: () => Promise<void>;
  handleImportDashboard: () => Promise<void>;
}

export const useDashboardImportExport = ({
  activeDashboard,
  dashboards,
  notification,
  saveDashboards,
}: UseDashboardImportExportParams): DashboardImportExportActions => {
  const handleExportDashboard = useCallback(async () => {
    if (!activeDashboard) return;
    if (!canExportAnalysisDashboard()) {
      notification.error('エクスポート機能が利用できません。');
      return;
    }

    const defaultName = `${activeDashboard.name || 'dashboard'}.stad`;
    const filePath = await requestAnalysisDashboardExportPath(defaultName);
    if (!filePath) return;

    const ok = await writeAnalysisDashboardPackage(
      filePath,
      buildAnalysisDashboardExportContent(activeDashboard),
    );
    if (ok) {
      notification.success('ダッシュボードをエクスポートしました。');
    } else {
      notification.error('エクスポートに失敗しました。');
    }
  }, [activeDashboard, notification]);

  const importDashboardFromPath = useCallback(
    async (filePath: string) => {
      if (!canImportAnalysisDashboard()) {
        notification.error('インポート機能が利用できません。');
        return;
      }

      const content = await readAnalysisDashboardImportContent(filePath);
      if (!content) {
        notification.error('ファイルの読み込みに失敗しました。');
        return;
      }

      try {
        const { nextDashboards, nextActiveId } =
          parseAnalysisDashboardImportContent({
            content,
            existingDashboards: dashboards,
            generateDashboardId,
          });

        await saveDashboards(nextDashboards, nextActiveId);
        notification.success('ダッシュボードをインポートしました。');
      } catch (error: unknown) {
        console.error('Failed to import dashboard:', error);
        notification.error(
          error instanceof Error ? error.message : 'インポートに失敗しました。',
        );
      }
    },
    [dashboards, notification, saveDashboards],
  );

  const handleImportDashboard = useCallback(async () => {
    if (!canImportAnalysisDashboard()) {
      notification.error('インポート機能が利用できません。');
      return;
    }

    const filePath = await requestAnalysisDashboardImportPath();
    if (!filePath) return;
    await importDashboardFromPath(filePath);
  }, [importDashboardFromPath, notification]);

  useEffect(() => {
    const unsubscribe = subscribeAnalysisDashboardExternalOpen((filePath) => {
      if (typeof filePath !== 'string' || filePath.length === 0) return;
      void importDashboardFromPath(filePath);
    });
    return unsubscribe;
  }, [importDashboardFromPath]);

  return {
    handleExportDashboard,
    handleImportDashboard,
  };
};
