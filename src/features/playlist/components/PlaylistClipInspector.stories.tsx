import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box } from '@mui/material';
import { PlaylistClipInspector } from './PlaylistClipInspector';
const meta = {
  title: 'Workspace/Playlist/Inspector',
  component: PlaylistClipInspector,
  decorators: [
    (Story) => (
      <Box sx={{ display: 'flex', minHeight: 420 }}>
        <Story />
      </Box>
    ),
  ],
  args: {
    item: null,
    width: 300,
    onEditNote: () => {},
    onPlay: () => {},
    onUpdateNote: () => {},
  },
} satisfies Meta<typeof PlaylistClipInspector>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Empty: Story = {};
export const Clip: Story = {
  args: {
    item: {
      id: 'clip-1',
      timelineItemId: null,
      actionName: 'ターンオーバー',
      startTime: 1458,
      endTime: 1472.5,
      addedAt: 0,
      note: 'ボール奪取後、外側のスペースを確認。\n次のサポートの位置をレビューする。',
      labels: [{ name: '前半' }, { name: '敵陣22m' }],
      videoSource: 'Main camera',
    },
  },
};
export const Light: Story = { ...Clip, globals: { themeMode: 'light' } };
