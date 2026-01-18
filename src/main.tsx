import React, { useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { getAppTheme } from './theme';
import { NotificationProvider } from './contexts/NotificationProvider';
import { ThemeModeProvider, useThemeMode } from './contexts/ThemeModeContext';
import { ActionPresetProvider } from './contexts/ActionPresetContext';

/**
 * Root: テーマモード設定に応じてテーマを切り替え
 */
function ThemedApp() {
  const { effectiveMode } = useThemeMode();
  const theme = useMemo(() => getAppTheme(effectiveMode), [effectiveMode]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <NotificationProvider>
        <ActionPresetProvider>
          <App />
        </ActionPresetProvider>
      </NotificationProvider>
    </ThemeProvider>
  );
}

function Root() {
  return (
    <ThemeModeProvider>
      <ThemedApp />
    </ThemeModeProvider>
  );
}

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement,
);
root.render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
