import { useState, useEffect, useCallback } from 'react';
import {
  DEFAULT_SETTINGS,
  normalizeAppSettings,
  type AppSettings,
} from '../types/Settings';

interface UseSettingsResult {
  settings: AppSettings;
  isLoading: boolean;
  error: string | null;
  saveSettings: (newSettings: AppSettings) => Promise<boolean>;
  resetSettings: () => Promise<boolean>;
  reloadSettings: () => Promise<void>;
}

/**
 * アプリ設定を管理するカスタムフック
 */
export const useSettings = (): UseSettingsResult => {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSettings = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const api = globalThis.window.electronAPI;
      if (!api) {
        throw new Error('Electron API is not available');
      }

      setSettings(normalizeAppSettings(await api.loadSettings()));
    } catch (err) {
      console.error('Failed to load settings:', err);
      setError('設定の読み込みに失敗しました');
      setSettings(DEFAULT_SETTINGS);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const saveSettings = useCallback(
    async (newSettings: AppSettings): Promise<boolean> => {
      setError(null);
      try {
        const api = globalThis.window.electronAPI;
        if (!api) {
          throw new Error('Electron API is not available');
        }

        const normalizedSettings = normalizeAppSettings(newSettings);
        const success = await api.saveSettings(normalizedSettings);
        if (success) {
          setSettings(normalizedSettings);
          return true;
        }

        setError('設定の保存に失敗しました');
        return false;
      } catch (err) {
        console.error('Failed to save settings:', err);
        setError('設定の保存に失敗しました');
        return false;
      }
    },
    [],
  );

  const resetSettings = useCallback(async (): Promise<boolean> => {
    setError(null);
    try {
      const api = globalThis.window.electronAPI;
      if (!api) {
        throw new Error('Electron API is not available');
      }

      setSettings(normalizeAppSettings(await api.resetSettings()));
      return true;
    } catch (err) {
      console.error('Failed to reset settings:', err);
      setError('設定のリセットに失敗しました');
      return false;
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    const unsubscribe = globalThis.window.electronAPI?.onSettingsUpdated?.(
      () => {
        void loadSettings();
      },
    );
    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [loadSettings]);

  return {
    settings,
    isLoading,
    error,
    saveSettings,
    resetSettings,
    reloadSettings: loadSettings,
  };
};
