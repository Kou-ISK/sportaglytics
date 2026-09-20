import type { Meta, StoryObj } from '@storybook/react-vite';
import { PlaylistMediaStatusView } from './PlaylistMediaStatusView';
const meta = {
  title: 'Playlist/MediaStatus',
  component: PlaylistMediaStatusView,
  args: { loading: false, error: '', onRetry: () => undefined },
} satisfies Meta<typeof PlaylistMediaStatusView>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Loading: Story = { args: { loading: true } };
export const MissingMedia: Story = {
  args: {
    error:
      '同期情報を読み込めません。パッケージと元映像の接続を確認し、再試行してください。',
  },
};
