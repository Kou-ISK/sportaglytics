/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '@mui/material/styles';
import { getAppTheme } from '../../../../../../../theme';
import { buildCustomChartData } from '../../controllers/useCustomChartData';
import { DashboardWidgetGrid } from './DashboardWidgetGrid';
import {
  incompatibleReviewTimeline,
  reviewTimeline,
  reviewWidgets,
} from '../../fixtures/reviewTimeline';

afterEach(cleanup);
describe('dashboard data states', () => {
  it('distinguishes matching Japanese template data from incompatible data and true zero', () => {
    expect(reviewTimeline).toHaveLength(24);
    expect(incompatibleReviewTimeline).toHaveLength(24);
    expect(reviewWidgets).toHaveLength(3);
    for (const widget of reviewWidgets) {
      const config = {
        ...widget,
        teamRoleMap: { team1: 'Red', team2: 'Blue' },
      };
      expect(
        buildCustomChartData(reviewTimeline, ['Result', 'Type'], config).data
          .length,
      ).toBeGreaterThan(0);
      expect(
        buildCustomChartData(
          incompatibleReviewTimeline,
          ['結果', 'エリア'],
          config,
        ).data,
      ).toHaveLength(0);
      expect(
        buildCustomChartData([], ['Result', 'Type'], config).data,
      ).toHaveLength(0);
    }
  });
  it('keeps unmatched charts editable without declaring the timeline empty', () => {
    const edit = vi.fn();
    const duplicate = vi.fn();
    const move = vi.fn();
    const remove = vi.fn();
    render(
      <ThemeProvider theme={getAppTheme('dark')}>
        <DashboardWidgetGrid
          widgets={reviewWidgets}
          timeline={incompatibleReviewTimeline}
          isEditing
          availableGroups={['結果', 'エリア']}
          dashboardFilters={{}}
          teamRoleMap={{ team1: 'Red', team2: 'Blue' }}
          teamContext={{ team1Name: 'Red', team2Name: 'Blue' }}
          teamColorMap={{}}
          onAddWidget={vi.fn()}
          onEditWidget={edit}
          onDuplicateWidget={duplicate}
          onMoveWidget={move}
          onDeleteWidget={remove}
          onChartPointSelect={vi.fn()}
        />
      </ThemeProvider>,
    );
    expect(
      screen.getAllByText('このチャートの条件・軸に一致する場面がありません。'),
    ).toHaveLength(3);
    expect(screen.queryByText('タイムラインに場面がありません。')).toBeNull();
    fireEvent.click(
      screen.getByRole('button', { name: 'ポゼッション割合を編集' }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'ポゼッション割合を複製' }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'ポゼッション割合を下へ移動' }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'ポゼッション割合を削除' }),
    );
    expect(edit).toHaveBeenCalledWith(reviewWidgets[0]);
    expect(duplicate).toHaveBeenCalledWith(reviewWidgets[0]);
    expect(move).toHaveBeenCalledWith('template-possession', 'down');
    expect(remove).toHaveBeenCalledWith('template-possession');
  });
});
