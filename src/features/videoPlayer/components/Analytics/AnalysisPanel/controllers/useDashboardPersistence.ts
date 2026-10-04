import { useCallback, useRef, useState } from 'react';
import type {
  AnalysisDashboard,
  AppSettings,
} from '../../../../../../types/settings/coreTypes';

interface DashboardPersistenceParams {
  settings: AppSettings;
  saveSettings: (settings: AppSettings) => Promise<boolean>;
}
interface DashboardPersistence {
  isSaving: boolean;
  saveError: string | null;
  isSavePending: () => boolean;
  saveDashboards: (
    dashboards: AnalysisDashboard[],
    activeId: string,
  ) => Promise<boolean>;
}

export const useDashboardPersistence = ({
  settings,
  saveSettings,
}: DashboardPersistenceParams): DashboardPersistence => {
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const savingRef = useRef(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const isSavePending = useCallback((): boolean => savingRef.current, []);
  const saveDashboards = useCallback(
    async (
      dashboards: AnalysisDashboard[],
      activeId: string,
    ): Promise<boolean> => {
      if (savingRef.current) return false;
      savingRef.current = true;
      setIsSaving(true);
      setSaveError(null);
      try {
        const saved = await saveSettings({
          ...settingsRef.current,
          analysisDashboard: { dashboards, activeDashboardId: activeId },
        });
        if (!saved)
          setSaveError(
            'ダッシュボードを保存できませんでした。もう一度お試しください。',
          );
        return saved;
      } catch {
        setSaveError(
          'ダッシュボードを保存できませんでした。もう一度お試しください。',
        );
        return false;
      } finally {
        savingRef.current = false;
        setIsSaving(false);
      }
    },
    [saveSettings],
  );
  return { isSaving, saveError, isSavePending, saveDashboards };
};
