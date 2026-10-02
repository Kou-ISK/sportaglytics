import type { Meta, StoryObj } from '@storybook/react-vite';
import { DashboardHeaderBar } from './DashboardHeaderBar';
const meta = {
  title: 'Workspace/Analysis/DashboardHeader',
  component: DashboardHeaderBar,
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
