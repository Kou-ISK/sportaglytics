import { useCallback, useEffect } from 'react';
import type {
  AnalysisDashboard,
  AnalysisDashboardWidget,
} from '../../../../../../types/Settings';
import type { NotificationContextValue } from '../../../../../../contexts/NotificationContext';
import { subscribeAnalysisDashboardExternalOpen } from '../../../../app/gateways/analysisWindowGateway';
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
    const api = window.electronAPI;
    if (!api?.saveFileDialog || !api?.saveDashboardPackage) {
      notification.error('エクスポート機能が利用できません。');
      return;
    }
    const defaultName = `${activeDashboard.name || 'dashboard'}.stad`;
    const filePath = await api.saveFileDialog(defaultName, [
      { name: 'SporTagLytics Dashboard', extensions: ['stad'] },
    ]);
    if (!filePath) return;
    const payload = {
      version: 1,
      dashboard: activeDashboard,
    };
    const ok = await api.saveDashboardPackage(
      filePath,
      JSON.stringify(payload, null, 2),
    );
    if (ok) {
      notification.success('ダッシュボードをエクスポートしました。');
    } else {
      notification.error('エクスポートに失敗しました。');
    }
  }, [activeDashboard, notification]);

  const importDashboardFromPath = useCallback(
    async (filePath: string) => {
      const api = window.electronAPI;
      if (!api?.readTextFile || !api?.readDashboardPackage) {
        notification.error('インポート機能が利用できません。');
        return;
      }
      const lowerPath = filePath.toLowerCase();
      const content = lowerPath.endsWith('.stad')
        ? await api.readDashboardPackage(filePath)
        : await api.readTextFile(filePath);
      if (!content) {
        notification.error('ファイルの読み込みに失敗しました。');
        return;
      }
      try {
        const parsed = JSON.parse(content) as {
          dashboard?: AnalysisDashboard;
          dashboards?: AnalysisDashboard[];
          widgets?: AnalysisDashboardWidget[];
        };
        const importedDashboards: AnalysisDashboard[] = [];
        if (Array.isArray(parsed?.dashboards)) {
          importedDashboards.push(...parsed.dashboards);
        } else if (parsed?.dashboard) {
          importedDashboards.push(parsed.dashboard);
        } else if (Array.isArray(parsed?.widgets)) {
          importedDashboards.push({
            id: generateDashboardId(),
            name: 'インポート',
            widgets: parsed.widgets,
          });
        }
        if (importedDashboards.length === 0) {
          notification.error('ダッシュボード形式のJSONではありません。');
          return;
        }

        const existingIds = new Set(dashboards.map((item) => item.id));
        const normalized = importedDashboards.map((item, index) => {
          const baseId = item.id || generateDashboardId();
          let nextId = baseId;
          let counter = 1;
          while (existingIds.has(nextId)) {
            nextId = `${baseId}-${counter}`;
            counter += 1;
          }
          existingIds.add(nextId);
          return {
            id: nextId,
            name: item.name || `インポート${index + 1}`,
            widgets: Array.isArray(item.widgets) ? item.widgets : [],
          };
        });

        const nextDashboards = [...dashboards, ...normalized];
        await saveDashboards(nextDashboards, normalized[0].id);
        notification.success('ダッシュボードをインポートしました。');
      } catch (error) {
        console.error('Failed to import dashboard:', error);
        notification.error('インポートに失敗しました。');
      }
    },
    [dashboards, notification, saveDashboards],
  );

  const handleImportDashboard = useCallback(async () => {
    const api = window.electronAPI;
    if (!api?.openDashboardPackageDialog) {
      notification.error('インポート機能が利用できません。');
      return;
    }
    const filePath = await api.openDashboardPackageDialog([
      { name: 'SporTagLytics Dashboard', extensions: ['stad', 'json'] },
    ]);
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
