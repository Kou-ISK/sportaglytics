import type { Meta, StoryObj } from '@storybook/react-vite';
import { PlaybackCachePanelView } from './PlaybackCachePanelView';
const meta = {
  title: 'Video/PlaybackCachePanel',
  component: PlaybackCachePanelView,
  args: {
    open: true,
    onOpen: () => undefined,
    onClose: () => undefined,
    children: '映像表示領域',
    switching: false,
    error: null,
    cache: null,
  },
} satisfies Meta<typeof PlaybackCachePanelView>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Unsupported: Story = {};
export const Error: Story = {
  args: {
    error: '切替を完了できませんでした。原本の再生状態を確認してください。',
  },
};
