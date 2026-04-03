import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
} from 'react';
import { useMediaQuery } from '@mui/material';
import type { ThemeMode } from '../types/Settings';

interface ThemeContextValue {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  effectiveMode: 'light' | 'dark';
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export const useThemeMode = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeMode must be used within ThemeModeProvider');
  }
  return context;
};

interface ThemeModeProviderProps {
  children: React.ReactNode;
}

export const ThemeModeProvider: React.FC<ThemeModeProviderProps> = ({
  children,
}) => {
  const [themeMode, setThemeMode] = useState<ThemeMode>('system');
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');

  // 設定を読み込んで初期化
  useEffect(() => {
    const loadThemeMode = async () => {
      try {
        const api = globalThis.window.electronAPI;
        if (!api) return;

        const settings = await api.loadSettings();
        setThemeMode(settings.themeMode);
      } catch (err) {
        console.error('Failed to load theme mode:', err);
      }
    };
    loadThemeMode();
  }, []);

  // 実際に適用するモードを計算
  const effectiveMode = useMemo((): 'light' | 'dark' => {
    if (themeMode === 'system') {
      return prefersDark ? 'dark' : 'light';
    }
    return themeMode;
  }, [themeMode, prefersDark]);

  const value = useMemo(
    () => ({
      themeMode,
      setThemeMode,
      effectiveMode,
    }),
    [themeMode, effectiveMode],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
};
