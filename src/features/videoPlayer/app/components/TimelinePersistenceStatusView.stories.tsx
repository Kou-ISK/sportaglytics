import type { Meta, StoryObj } from '@storybook/react-vite';
import { TimelinePersistenceStatusView } from './TimelinePersistenceStatusView';

const meta = {
  title: 'Workspace/Timeline/PersistenceStatus',
  component: TimelinePersistenceStatusView,
} satisfies Meta<typeof TimelinePersistenceStatusView>;
export default meta;
type Story = StoryObj<typeof meta>;
export const ReadFailure: Story = {
  args: {
    feedback: {
      kind: 'load-error',
      message:
        'タイムラインを読み込めませんでした。自動保存を停止し、原本を保持しています。接続・アクセス権・形式を確認して再読み込みしてください。',
      onRetry: () => undefined,
    },
  },
};
export const SaveFailure: Story = {
  args: {
    feedback: {
      kind: 'save-error',
      message:
        'タイムラインの変更を保存できませんでした。変更は画面に残っています。保存先の接続・空き容量・アクセス権を確認し、保存を再試行してください。',
      onRetry: () => undefined,
    },
  },
};
