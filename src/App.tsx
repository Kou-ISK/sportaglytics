import React, { useState, useEffect } from 'react';
import './App.css';
import { VideoPlayerApp } from './pages/VideoPlayerApp';
import { SettingsPage } from './pages/SettingsPage';
import PlaylistWindowApp from './features/playlist/PlaylistWindowApp';
import { AnalysisWindowApp } from './pages/AnalysisWindowApp';

type AppView = 'main' | 'settings' | 'playlist' | 'analysis';

/**
 * URLハッシュからビューを取得
 */
const getViewFromHash = (): AppView => {
  const hash = window.location.hash;
  if (hash === '#/playlist') return 'playlist';
  if (hash === '#/settings') return 'settings';
  if (hash === '#/analysis') return 'analysis';
  return 'main';
};

function App() {
  const [currentView, setCurrentView] = useState<AppView>(getViewFromHash);

  // ハッシュ変更を監視
  useEffect(() => {
    const handleHashChange = () => {
      setCurrentView(getViewFromHash());
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    // メニューから設定を開くイベントをリッスン
    const handleOpenSettings = () => {
      // 可能なら別ウィンドウで開く（フォールバックで従来動作）
      if (globalThis.window.electronAPI?.openSettingsWindow) {
        globalThis.window.electronAPI.openSettingsWindow();
      } else {
        setCurrentView('settings');
      }
    };

    globalThis.window.electronAPI?.onOpenSettings(handleOpenSettings);

    return () => {
      globalThis.window.electronAPI?.offOpenSettings(handleOpenSettings);
    };
  }, []);

  // 設定画面からメインに戻る用のカスタムイベント
  useEffect(() => {
    const handleBackToMain = () => {
      setCurrentView('main');
    };

    globalThis.addEventListener('back-to-main', handleBackToMain);

    return () => {
      globalThis.removeEventListener('back-to-main', handleBackToMain);
    };
  }, []);

  // .stcwファイルが外部から開かれたときに設定画面を開く
  useEffect(() => {
    const api = globalThis.window.electronAPI;
    if (!api?.codeWindow?.onExternalOpen) return;

    const cleanup = api.codeWindow.onExternalOpen(() => {
      // 設定画面を開く（コードウィンドウタブに切り替えはCodeWindowSettings内で処理）
      if (api.openSettingsWindow) {
        api.openSettingsWindow();
      } else {
        setCurrentView('settings');
      }
    });

    return cleanup;
  }, []);

  // プレイリストウィンドウ（別ウィンドウで開かれた場合）
  if (currentView === 'playlist') {
    return <PlaylistWindowApp />;
  }

  if (currentView === 'settings') {
    return <SettingsPage />;
  }

  if (currentView === 'analysis') {
    return <AnalysisWindowApp />;
  }

  return <VideoPlayerApp />;
}

export default App;
