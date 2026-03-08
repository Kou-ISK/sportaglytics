import { useCallback } from 'react';
import type { AIAnalysisSettings, AppSettings } from '../../../../../../../../types/Settings';

interface UseAIAnalysisSettingsActionsParams {
  settings: AppSettings;
  aiSettings: AIAnalysisSettings;
  saveSettings: (newSettings: AppSettings) => Promise<boolean>;
  setSettingsMessage: (message: string | null) => void;
}

export const useAIAnalysisSettingsActions = ({
  settings,
  aiSettings,
  saveSettings,
  setSettingsMessage,
}: UseAIAnalysisSettingsActionsParams) => {
  const handleSaveSettings = useCallback(async () => {
    setSettingsMessage(null);
    const success = await saveSettings({
      ...settings,
      aiAnalysis: aiSettings,
    });
    setSettingsMessage(success ? 'AI設定を保存しました。' : 'AI設定の保存に失敗しました。');
  }, [aiSettings, saveSettings, setSettingsMessage, settings]);

  return {
    handleSaveSettings,
  };
};
