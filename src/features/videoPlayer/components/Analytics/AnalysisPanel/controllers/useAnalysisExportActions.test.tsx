/* @vitest-environment jsdom */
import { cloneElement, useRef } from 'react';
import type { ReactElement } from 'react';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ThemeProvider } from '@mui/material/styles';
import { getAppTheme } from '../../../../../../theme';
import { useAnalysisExportActions } from './useAnalysisExportActions';
import { AnalysisPanelToolbar } from '../components/analysisPanelView/AnalysisPanelToolbar';
import { CustomPieChart } from '../components/CustomPieChart';
import { createDefaultMatrixFilters } from './matrixFilterUtils';
import * as gateway from '../gateways/analysisExportGateway';

vi.mock('recharts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('recharts')>()),
  ResponsiveContainer: ({
    children,
  }: {
    children: ReactElement<{ width: number; height: number }>;
  }) => cloneElement(children, { width: 600, height: 260 }),
}));
vi.mock('../gateways/analysisExportGateway', () => ({
  canCaptureAnalysisWindowRegion: () => true,
  canExportAnalysisPng: () => true,
  captureAnalysisWindowRegionAsPng: vi.fn(),
  exportAnalysisPngParts: vi.fn(async () => ({ success: true, partCount: 1 })),
  copyAnalysisSummaryToClipboard: vi.fn(),
}));
vi.mock(
  '../../../../../../utils/fullContentCapture',
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import('../../../../../../utils/fullContentCapture')
    >()),
    // Raster stitching is covered separately; retain real layout and scroll capture.
    stitchCapturedSlicesIntoParts: async () => [
      'data:image/png;base64,synthetic',
    ],
  }),
);

const notification = {
  notify: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
};
function Harness(): ReactElement {
  const target = useRef<HTMLDivElement>(null);
  const actions = useAnalysisExportActions({
    currentView: 'dashboard',
    timeline: [],
    resolvedTeamNames: ['Red', 'Blue'],
    dashboardFilters: {},
    matrixAxes: { row: { type: 'team' }, column: { type: 'action' } },
    matrixFilters: createDefaultMatrixFilters(),
    analysisDashboard: undefined,
    notification,
    exportTargetRef: target,
  });
  return (
    <ThemeProvider theme={getAppTheme('light')}>
      <AnalysisPanelToolbar
        currentView="dashboard"
        onChangeView={() => {}}
        isExporting={actions.isExporting}
        exportAnchor={actions.exportAnchor}
        setExportAnchor={actions.setExportAnchor}
        onCloseExportMenu={actions.closeExportMenu}
        onCopySummary={actions.handleCopySummary}
        onExportPng={actions.handleExportPng}
        onExportPdf={actions.handleExportPdf}
      />
      <div ref={target} data-testid="capture-root">
        <CustomPieChart
          data={[{ name: 'Synthetic', value: 100, rawValue: 4 }]}
          seriesKeys={['value']}
          metric="count"
          unitLabel="%"
          calcMode="percentTotal"
          disableAnimation={actions.isExporting}
        />
      </div>
    </ThemeProvider>
  );
}
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

it('removes the real menu and finishes pie labels before the first native capture', async () => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(0, 0, 600, 260),
  );
  vi.mocked(gateway.captureAnalysisWindowRegionAsPng).mockImplementation(
    async () => {
      expect(document.querySelector('[role="menu"]')).toBeNull();
      expect(
        document.querySelector('.recharts-pie-label-text')?.textContent,
      ).toBe('Synthetic: 100.0%');
      return { png: 'synthetic', scale: 1 };
    },
  );
  render(<Harness />);
  // Export while Recharts' JavaScript animation is actively hiding labels.
  await waitFor(() => {
    expect(document.querySelector('.recharts-pie-sector')).not.toBeNull();
    expect(document.querySelector('.recharts-pie-label-text')).toBeNull();
  });
  fireEvent.click(screen.getByRole('button', { name: 'エクスポート' }));
  fireEvent.click(
    screen.getByRole('menuitem', { name: '現在タブをPNGで保存（全内容）' }),
  );
  await waitFor(() =>
    expect(gateway.exportAnalysisPngParts).toHaveBeenCalledOnce(),
  );
  expect(gateway.captureAnalysisWindowRegionAsPng).toHaveBeenCalledOnce();
  expect(notification.error).not.toHaveBeenCalled();
  expect(notification.success).toHaveBeenCalledWith('PNGを保存しました。');
});

it('does not save a partial image or claim success after a capture failure', async () => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(0, 0, 600, 260),
  );
  vi.mocked(gateway.captureAnalysisWindowRegionAsPng).mockRejectedValue(
    new Error('synthetic capture failure'),
  );
  const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
  render(<Harness />);
  fireEvent.click(screen.getByRole('button', { name: 'エクスポート' }));
  fireEvent.click(
    screen.getByRole('menuitem', { name: '現在タブをPNGで保存（全内容）' }),
  );
  await waitFor(() =>
    expect(notification.error).toHaveBeenCalledWith(
      '全内容キャプチャに失敗しました。',
    ),
  );
  expect(gateway.exportAnalysisPngParts).not.toHaveBeenCalled();
  expect(notification.success).not.toHaveBeenCalled();
  expect(logged).toHaveBeenCalledOnce();
  expect(
    screen
      .getByRole('button', { name: 'エクスポート' })
      .hasAttribute('disabled'),
  ).toBe(false);
});

it('restores the viewport and proof before a canceled save dialog', async () => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(0, 0, 600, 260),
  );
  vi.mocked(gateway.captureAnalysisWindowRegionAsPng).mockResolvedValue({
    png: 'synthetic',
    scale: 1,
  });
  vi.mocked(gateway.exportAnalysisPngParts).mockImplementationOnce(async () => {
    expect(document.querySelector('[data-capture-proof]')).toBeNull();
    expect(screen.getByTestId('capture-root').style.paddingTop).toBe('');
    return { success: false, canceled: true, partCount: 0 };
  });
  render(<Harness />);
  fireEvent.click(screen.getByRole('button', { name: 'エクスポート' }));
  fireEvent.click(
    screen.getByRole('menuitem', { name: '現在タブをPNGで保存（全内容）' }),
  );
  await waitFor(() =>
    expect(gateway.exportAnalysisPngParts).toHaveBeenCalledOnce(),
  );
  await waitFor(() =>
    expect(
      screen
        .getByRole('button', { name: 'エクスポート' })
        .hasAttribute('disabled'),
    ).toBe(false),
  );
  expect(notification.success).not.toHaveBeenCalled();
  expect(notification.error).not.toHaveBeenCalled();
});
