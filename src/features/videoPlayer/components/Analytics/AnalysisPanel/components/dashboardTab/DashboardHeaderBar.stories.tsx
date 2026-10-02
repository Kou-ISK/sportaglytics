import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box } from '@mui/material';
import { DashboardHeaderBar } from './DashboardHeaderBar';
import { DashboardFilterControl } from './DashboardFilterControl';
import { DashboardFilterEditor } from './DashboardFilterEditor';
const meta = {
  title: 'Workspace/Analysis/DashboardHeader',
  component: DashboardHeaderBar,
  decorators: [
    (Story) => (
      <Box sx={{ p: 1.5, overflow: 'auto' }}>
        <Story />
      </Box>
    ),
  ],
  args: {
    compactControlSx: {
      '& .MuiInputBase-input': { py: 0.75 },
      '& .MuiSelect-select': { py: 0.75 },
    },
    activeDashboardId: 'template-basic',
    dashboards: [
      { id: 'template-basic', name: '基本分析テンプレート', widgets: [] },
      { id: 'synthetic-copy', name: '合成分析（コピー）', widgets: [] },
    ],
    isEditing: false,
    isSaving: false,
    filterControl: (
      <DashboardFilterControl
        filterCount={0}
        renderEditor={(onClose) => (
          <DashboardFilterEditor
            compactControlSx={{
              '& .MuiInputBase-input': { py: 0.75 },
              '& .MuiSelect-select': { py: 0.75 },
            }}
            dashboardFilters={{}}
            availableTeams={['Red', 'Blue']}
            availableActions={['スクラム', 'ポゼッション']}
            availableGroups={['Result', 'Type']}
            availableLabelValues={{
              Result: ['Try', '継続'],
              Type: ['中央', 'サイド'],
            }}
            updateDashboardFilters={() => {}}
            onResetFilters={() => {}}
            onClose={onClose}
          />
        )}
      />
    ),
    onDashboardChange: () => {},
    onStartEdit: () => {},
    onAddWidget: () => {},
    onCancelEdit: () => {},
    onSave: () => {},
    onOpenManagementMenu: () => {},
  },
} satisfies Meta<typeof DashboardHeaderBar>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Template: Story = {};
export const TemplateLight: Story = { globals: { themeMode: 'light' } };
export const CopyPending: Story = { args: { isSaving: true } };
export const Editable: Story = {
  args: { activeDashboardId: 'synthetic-copy' },
};
export const Editing: Story = {
  args: { activeDashboardId: 'synthetic-copy', isEditing: true },
};
export const Saving: Story = { args: { ...Editing.args, isSaving: true } };
export const NarrowLongName: Story = {
  args: {
    activeDashboardId: 'synthetic-long',
    dashboards: [
      {
        id: 'synthetic-long',
        name: '合成ダッシュボード・長い名前の表示と切替の確認',
        widgets: [],
      },
    ],
  },
  decorators: [
    (Story) => (
      <Box sx={{ width: 400, maxWidth: '100%' }}>
        <Story />
      </Box>
    ),
  ],
};
