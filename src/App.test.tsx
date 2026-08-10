import { describe, expect, it, vi } from 'vitest';

vi.mock('./pages/VideoPlayerApp', () => ({
  VideoPlayerApp: () => null,
}));
vi.mock('./pages/SettingsPage', () => ({
  SettingsPage: () => null,
}));
vi.mock('./features/playlist', () => ({
  PlaylistWindowApp: () => null,
}));
vi.mock('./pages/AnalysisWindowApp', () => ({
  AnalysisWindowApp: () => null,
}));
vi.mock('./pages/AnalysisReportPage', () => ({
  AnalysisReportPage: () => null,
}));
vi.mock('./pages/ExportProgressWindowApp', () => ({
  ExportProgressWindowApp: () => null,
}));
vi.mock('./hooks/useAppShellController', () => ({
  useAppShellController: vi.fn(),
}));
vi.mock('./features/videoPlayer', () => ({
  CodingPanelWindowScreen: () => null,
}));

import App from './App';

describe('App', () => {
  it('exports a component', () => {
    expect(typeof App).toBe('function');
  });
});
