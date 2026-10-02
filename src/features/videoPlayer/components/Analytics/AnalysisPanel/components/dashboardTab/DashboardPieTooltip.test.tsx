/* @vitest-environment jsdom */
import { cloneElement } from 'react';
import type { ReactElement } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '@mui/material/styles';
import { getAppTheme } from '../../../../../../../theme';
import type { AnalysisDashboardWidget } from '../../../../../../../types/settings/coreTypes';
import { reviewTimeline, reviewWidgets } from '../../fixtures/reviewTimeline';
import { CustomPieChart } from '../CustomPieChart';
import { DashboardWidgetGrid } from './DashboardWidgetGrid';

// jsdom has no layout; only supply dimensions. Keep real Recharts hover/tooltip.
vi.mock('recharts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('recharts')>()),
  ResponsiveContainer: ({
    children,
  }: {
    children: ReactElement<{ width: number; height: number }>;
  }) => cloneElement(children, { width: 600, height: 260 }),
}));

afterEach(cleanup);

const renderWidget = (widget: AnalysisDashboardWidget): void => {
  render(
    <ThemeProvider theme={getAppTheme('dark')}>
      <DashboardWidgetGrid
        widgets={[widget]}
        timeline={reviewTimeline}
        isEditing={false}
        availableGroups={['Result', 'Type']}
        dashboardFilters={{}}
        teamRoleMap={{ team1: 'Red', team2: 'Blue' }}
        teamContext={{ team1Name: 'Red', team2Name: 'Blue' }}
        teamColorMap={{}}
        onAddWidget={vi.fn()}
        onEditWidget={vi.fn()}
        onDuplicateWidget={vi.fn()}
        onMoveWidget={vi.fn()}
        onDeleteWidget={vi.fn()}
        onChartPointSelect={vi.fn()}
      />
    </ThemeProvider>,
  );
};

const hoverFirstSector = (): void => {
  const sector = document.querySelector('.recharts-pie-sector');
  expect(sector).not.toBeNull();
  if (sector) fireEvent.mouseEnter(sector);
};

describe('dashboard pie tooltip', () => {
  it('shows the original count for a 100% template slice', async () => {
    renderWidget(reviewWidgets[1]);
    hoverFirstSector();
    expect(await screen.findByText('100.0% (4件)')).toBeTruthy();
    expect(screen.queryByText('100.0% (100%)')).toBeNull();
  });

  it('shows the original duration in seconds for possession', async () => {
    renderWidget(reviewWidgets[0]);
    hoverFirstSector();
    expect(await screen.findByText('50.0% (16.0秒)')).toBeTruthy();
  });

  it('keeps raw-count pie values in count units', async () => {
    renderWidget({ ...reviewWidgets[1], calc: 'raw' });
    hoverFirstSector();
    expect(await screen.findByText('100.0% (4件)')).toBeTruthy();
  });

  it('uses rawValue from explicitly configured series', async () => {
    renderWidget({
      ...reviewWidgets[0],
      metric: 'count',
      dataMode: 'series',
      series: [
        { id: 'red', name: 'Red', filters: { teamRole: 'team1' } },
        { id: 'blue', name: 'Blue', filters: { teamRole: 'team2' } },
      ],
    });
    hoverFirstSector();
    expect(await screen.findByText('50.0% (4件)')).toBeTruthy();
  });

  it('shows only the supplied percentage when the raw value is absent', async () => {
    render(
      <ThemeProvider theme={getAppTheme('dark')}>
        <CustomPieChart
          data={[{ name: 'Synthetic', value: 25 }]}
          seriesKeys={['value']}
          metric="count"
          unitLabel="%"
          calcMode="percentTotal"
          disableAnimation
        />
      </ThemeProvider>,
    );
    hoverFirstSector();
    expect(await screen.findByText('25.0%')).toBeTruthy();
    expect(screen.queryByText(/件/)).toBeNull();
  });
});
