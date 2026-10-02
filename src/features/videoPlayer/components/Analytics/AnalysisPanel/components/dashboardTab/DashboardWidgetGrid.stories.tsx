import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box } from '@mui/material';
import { DashboardWidgetGrid } from './DashboardWidgetGrid';
import { NoDataPlaceholder } from '../NoDataPlaceholder';
import {
  incompatibleReviewTimeline,
  reviewTimeline,
  reviewWidgets,
} from '../../fixtures/reviewTimeline';
import { createTemplateDashboardWidgets } from '../../../../../../../types/settings/defaults';

const meta = {
  title: 'Workspace/Analysis/Dashboard',
  component: DashboardWidgetGrid,
  decorators: [
    (Story) => (
      <Box sx={{ p: 2 }}>
        <Story />
      </Box>
    ),
  ],
  args: {
    widgets: reviewWidgets,
    isEditing: false,
    timeline: reviewTimeline,
    availableGroups: ['Result', 'Type'],
    dashboardFilters: {},
    teamRoleMap: { team1: 'Red', team2: 'Blue' },
    teamContext: { team1Name: 'Red', team2Name: 'Blue' },
    teamColorMap: {},
    onAddWidget: () => {},
    onEditWidget: () => {},
    onDuplicateWidget: () => {},
    onMoveWidget: () => {},
    onDeleteWidget: () => {},
    onChartPointSelect: () => {},
  },
} satisfies Meta<typeof DashboardWidgetGrid>;
export default meta;
type Story = StoryObj<typeof meta>;
export const MatchingData: Story = {};
export const Light: Story = { globals: { themeMode: 'light' } };
export const TemplateMismatch: Story = {
  args: {
    timeline: incompatibleReviewTimeline,
    availableGroups: ['結果', 'エリア'],
  },
};
export const MixedTemplate: Story = {
  args: { widgets: createTemplateDashboardWidgets() },
};
export const FilterNoMatches: Story = {
  args: { dashboardFilters: { action: '存在しないアクション' } },
};
export const EditEmptyCharts: Story = {
  ...TemplateMismatch,
  args: { ...TemplateMismatch.args, isEditing: true },
};
// Mirrors DashboardTabView's true-zero guard; it is not a template-mismatch state.
export const NoTimeline: Story = {
  render: () => (
    <NoDataPlaceholder message="ダッシュボードを表示するにはタイムラインを作成してください。" />
  ),
};
export const NoWidgets: Story = { args: { widgets: [] } };
