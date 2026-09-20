import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { TimelineRowActionsView } from './TimelineRowActionsView';
import { reviewRows } from '../../../fixtures/timelineReview';

const meta: Meta<typeof TimelineRowActionsView> = {
  title: 'Workspace/Timeline/Row Actions',
  component: TimelineRowActionsView,
  args: {
    rows: reviewRows,
    rowContextMenu: null,
    rowsPendingDeletion: [],
    onCloseRowContextMenu: fn(),
    onEditContextRow: fn(),
    onMoveSelectedRow: fn(),
    onRequestDeleteRows: fn(),
    onCancelDeleteRows: fn(),
    onConfirmDeleteRows: fn(),
    onSelectRowItems: fn(),
  },
};
export default meta;
type Story = StoryObj<typeof meta>;
export const Menu: Story = {
  args: {
    rowContextMenu: { rowId: reviewRows[0].id, mouseX: 120, mouseY: 120 },
  },
};
export const DeleteRows: Story = {
  args: { rowsPendingDeletion: reviewRows.slice(0, 2) },
};
