import React from 'react';
import './App.css';
import { VideoPlayerApp } from './pages/VideoPlayerApp';
import { SettingsPage } from './pages/SettingsPage';
import { PlaylistWindowApp } from './features/playlist';
import { AnalysisWindowApp } from './pages/AnalysisWindowApp';
import { AnalysisReportPage } from './pages/AnalysisReportPage';
import { ExportProgressWindowApp } from './pages/ExportProgressWindowApp';
import { useAppShellController } from './hooks/useAppShellController';
import { CodingPanelWindowScreen } from './features/videoPlayer';

function App() {
  const currentView = useAppShellController();

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

  if (currentView === 'analysis-report') {
    return <AnalysisReportPage />;
  }

  if (currentView === 'export-progress') {
    return <ExportProgressWindowApp />;
  }

  if (currentView === 'coding-panel') {
    return <CodingPanelWindowScreen />;
  }

  return <VideoPlayerApp />;
}

export default App;
