import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { AnalysisReportPage } from './AnalysisReportPage';
import { AnalysisWindowApp } from './AnalysisWindowApp';
import { SettingsPage } from './SettingsPage';
import { VideoPlayerApp } from './VideoPlayerApp';

vi.mock('../features/settings', () => ({
  SettingsScreen: () => <div data-testid="settings-screen" />,
}));

vi.mock('../features/analysisReport', () => ({
  AnalysisReportScreen: () => <div data-testid="analysis-report-screen" />,
}));

vi.mock('../features/playlist', () => ({
  PlaylistProvider: ({ children }: { children: ReactNode }) => (
    <div data-testid="playlist-provider">{children}</div>
  ),
}));

vi.mock('../features/videoPlayer', () => ({
  VideoPlayerScreen: () => <div data-testid="video-player-screen" />,
  AnalysisWindowScreen: () => <div data-testid="analysis-window-screen" />,
}));

describe('page wrappers', () => {
  it('delegates SettingsPage to SettingsScreen', () => {
    expect(renderToStaticMarkup(<SettingsPage />)).toContain('settings-screen');
  });

  it('delegates AnalysisReportPage to AnalysisReportScreen', () => {
    expect(renderToStaticMarkup(<AnalysisReportPage />)).toContain(
      'analysis-report-screen',
    );
  });

  it('delegates AnalysisWindowApp to AnalysisWindowScreen', () => {
    expect(renderToStaticMarkup(<AnalysisWindowApp />)).toContain(
      'analysis-window-screen',
    );
  });

  it('wraps VideoPlayerScreen with PlaylistProvider', () => {
    const html = renderToStaticMarkup(<VideoPlayerApp />);
    expect(html).toContain('playlist-provider');
    expect(html).toContain('video-player-screen');
  });
});
