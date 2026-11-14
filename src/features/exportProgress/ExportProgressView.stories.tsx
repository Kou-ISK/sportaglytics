import type { Meta, StoryObj } from '@storybook/react-vite';
import { ExportProgressView } from './ExportProgressView';

const meta = {
  title: 'Export/Progress',
  component: ExportProgressView,
  args: {
    state: {
      id: 'example',
      status: 'running',
      current: 3,
      total: 10,
      message: '書き出し中',
      startedAt: 1000,
      updatedAt: 2000,
    },
    now: 3000,
    pending: false,
    notice: null,
    onCancel: () => undefined,
    onClose: () => undefined,
  },
} satisfies Meta<typeof ExportProgressView>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Running: Story = {};
export const Cancelling: Story = {
  args: {
    state: {
      id: 'example',
      status: 'cancelling',
      current: 3,
      total: 10,
      message: '中止中',
      startedAt: 1000,
      updatedAt: 2000,
    },
  },
};
export const Cancelled: Story = {
  args: {
    state: {
      id: 'example',
      status: 'cancelled',
      current: 3,
      total: 10,
      message: '1件は保存済み',
      startedAt: 1000,
      updatedAt: 2000,
    },
  },
};
