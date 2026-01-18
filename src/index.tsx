import React, { useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
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

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
