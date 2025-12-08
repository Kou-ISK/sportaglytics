import { useState, useEffect, useCallback } from 'react';
import type { AppSettings } from '../types/Settings';
import { DEFAULT_SETTINGS } from '../types/Settings';

/**
 * アプリ設定を管理するカスタムフック
 */
export const useSettings = () => {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 設定を読み込む
  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const api = globalThis.window.electronAPI;
      if (!api) {
        throw new Error('Electron API is not available');
      }
      const loaded = (await api.loadSettings()) as AppSettings;
      // 新フィールドがない場合の後方互換
      const merged: AppSettings = {
        ...DEFAULT_SETTINGS,
        ...loaded,
        overlayClip: {
          ...DEFAULT_SETTINGS.overlayClip,
          ...(loaded as Partial<AppSettings>).overlayClip,
        },
        codingPanel: {
          ...DEFAULT_SETTINGS.codingPanel,
          ...(loaded as Partial<AppSettings>).codingPanel,
          defaultMode:
            (loaded as Partial<AppSettings>).codingPanel?.defaultMode ??
            DEFAULT_SETTINGS.codingPanel?.defaultMode ??
            'code',
          toolbars:
            (loaded as Partial<AppSettings>).codingPanel?.toolbars?.filter(
              (t) => t.mode === 'code' || t.mode === 'label',
            ) ?? DEFAULT_SETTINGS.codingPanel?.toolbars ?? [],
          actionLinks:
            (loaded as Partial<AppSettings>).codingPanel?.actionLinks ??
            DEFAULT_SETTINGS.codingPanel?.actionLinks ??
            [],
        },
      };
      setSettings(merged);
    } catch (err) {
      console.error('Failed to load settings:', err);
      setError('設定の読み込みに失敗しました');
      setSettings(DEFAULT_SETTINGS);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 設定を保存する
  const saveSettings = useCallback(async (newSettings: AppSettings) => {
    setError(null);
    try {
      const api = globalThis.window.electronAPI;
      if (!api) {
        throw new Error('Electron API is not available');
      }
      const success = await api.saveSettings(newSettings);
      if (success) {
        setSettings(newSettings);
        return true;
      } else {
        setError('設定の保存に失敗しました');
        return false;
      }
    } catch (err) {
      console.error('Failed to save settings:', err);
      setError('設定の保存に失敗しました');
      return false;
    }
  }, []);

  // 設定をリセット
  const resetSettings = useCallback(async () => {
    setError(null);
    try {
      const api = globalThis.window.electronAPI;
      if (!api) {
        throw new Error('Electron API is not available');
      }
      const defaultSettings = (await api.resetSettings()) as AppSettings;
      const merged: AppSettings = {
        ...DEFAULT_SETTINGS,
        ...defaultSettings,
        overlayClip: {
          ...DEFAULT_SETTINGS.overlayClip,
          ...(defaultSettings as Partial<AppSettings>).overlayClip,
        },
        codingPanel: {
          ...DEFAULT_SETTINGS.codingPanel,
          ...(defaultSettings as Partial<AppSettings>).codingPanel,
          defaultMode:
            (defaultSettings as Partial<AppSettings>).codingPanel?.defaultMode ??
            DEFAULT_SETTINGS.codingPanel?.defaultMode ??
            'code',
          toolbars:
            (defaultSettings as Partial<AppSettings>).codingPanel?.toolbars?.filter(
              (t) => t.mode === 'code' || t.mode === 'label',
            ) ?? DEFAULT_SETTINGS.codingPanel?.toolbars ?? [],
          actionLinks:
            (defaultSettings as Partial<AppSettings>).codingPanel?.actionLinks ??
            DEFAULT_SETTINGS.codingPanel?.actionLinks ??
            [],
        },
      };
      setSettings(merged);
      return true;
    } catch (err) {
      console.error('Failed to reset settings:', err);
      setError('設定のリセットに失敗しました');
      return false;
    }
  }, []);

  // 初回マウント時に設定を読み込む
  useEffect(() => {
    loadSettings();
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
