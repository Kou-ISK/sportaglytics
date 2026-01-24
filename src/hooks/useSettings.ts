import { useState, useEffect, useCallback } from 'react';
import type { AppSettings } from '../types/Settings';
import {
  DEFAULT_SETTINGS,
  normalizeCodingPanelLayouts,
  normalizeAnalysisDashboard,
} from '../types/Settings';

/**
 * アプリ設定を管理するカスタムフック
 */
export const useSettings = () => {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const buildCodingPanel = (
    loadedPanel?: AppSettings['codingPanel'] | null,
  ): NonNullable<AppSettings['codingPanel']> => {
    const defaultCodingPanel: NonNullable<AppSettings['codingPanel']> =
      DEFAULT_SETTINGS.codingPanel ?? {
        defaultMode: 'code',
        toolbars: [],
        actionLinks: [],
        codeWindows: [],
        activeCodeWindowId: 'default',
      };
    const panel: Partial<NonNullable<AppSettings['codingPanel']>> =
      loadedPanel ?? {};
    const codeWindows =
      panel.codeWindows && panel.codeWindows.length > 0
        ? panel.codeWindows
        : (defaultCodingPanel.codeWindows ?? []);
    const activeCodeWindowId =
      panel.activeCodeWindowId ??
      (panel as { activeLayoutId?: string }).activeLayoutId ??
      defaultCodingPanel.activeCodeWindowId ??
      codeWindows[0]?.id;

    return normalizeCodingPanelLayouts({
      ...defaultCodingPanel,
      ...panel,
      defaultMode:
        panel.defaultMode ?? defaultCodingPanel.defaultMode ?? 'code',
      toolbars:
        panel.toolbars?.filter(
          (t) => t.mode === 'code' || t.mode === 'label',
        ) ??
        defaultCodingPanel.toolbars ??
        [],
      actionLinks: panel.actionLinks ?? defaultCodingPanel.actionLinks ?? [],
      codeWindows,
      activeCodeWindowId,
    });
  };

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
      // hotkeysのマージ: 保存された設定に存在しないホットキーをデフォルトから補完
      const loadedHotkeys = (loaded as Partial<AppSettings>).hotkeys ?? [];
      const loadedHotkeyIds = new Set(loadedHotkeys.map((h) => h.id));
      const mergedHotkeys = [
        ...loadedHotkeys,
        ...DEFAULT_SETTINGS.hotkeys.filter((h) => !loadedHotkeyIds.has(h.id)),
      ];

      const merged: AppSettings = {
        ...DEFAULT_SETTINGS,
        ...loaded,
        hotkeys: mergedHotkeys,
        overlayClip: {
          ...DEFAULT_SETTINGS.overlayClip,
          ...(loaded as Partial<AppSettings>).overlayClip,
        },
        codingPanel: buildCodingPanel(
          (loaded as Partial<AppSettings>).codingPanel,
        ),
        analysisDashboard: normalizeAnalysisDashboard(
          (loaded as Partial<AppSettings>).analysisDashboard,
        ),
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
      // hotkeysのマージ
      const loadedHotkeys =
        (defaultSettings as Partial<AppSettings>).hotkeys ?? [];
      const loadedHotkeyIds = new Set(loadedHotkeys.map((h) => h.id));
      const mergedHotkeys = [
        ...loadedHotkeys,
        ...DEFAULT_SETTINGS.hotkeys.filter((h) => !loadedHotkeyIds.has(h.id)),
      ];

      const merged: AppSettings = {
        ...DEFAULT_SETTINGS,
        ...defaultSettings,
        hotkeys: mergedHotkeys,
        overlayClip: {
          ...DEFAULT_SETTINGS.overlayClip,
          ...(defaultSettings as Partial<AppSettings>).overlayClip,
        },
        codingPanel: buildCodingPanel(
          (defaultSettings as Partial<AppSettings>).codingPanel,
        ),
        analysisDashboard: normalizeAnalysisDashboard(
          (defaultSettings as Partial<AppSettings>).analysisDashboard,
        ),
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

  // 設定更新イベントを購読（別ウィンドウで保存されたら再読み込み）
  useEffect(() => {
    const unsubscribe = globalThis.window.electronAPI?.onSettingsUpdated?.(
      () => {
        loadSettings();
      },
    );
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
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
