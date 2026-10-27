import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box } from '@mui/material';
import { SingleVideoPlayerView } from './SingleVideoPlayerView';

const meta = {
  title: 'Video/SingleVideoPlayer',
  component: SingleVideoPlayerView,
  decorators: [
    (Story) => (
      <Box sx={{ position: 'relative', width: 640, height: 360 }}>
        <Story />
      </Box>
    ),
  ],
  args: {
    containerRef: { current: null },
    videoRef: { current: null },
    id: 'synthetic-video',
    overlayMessage: null,
    isHovered: true,
    setIsHovered: () => undefined,
    isFullscreen: false,
    handleToggleFullscreen: () => undefined,
    nativeSurface: null,
  },
} satisfies Meta<typeof SingleVideoPlayerView>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Empty: Story = {};
export const Waiting: Story = {
  args: { overlayMessage: '同期オフセットを待機中…' },
};
export const Fullscreen: Story = { args: { isFullscreen: true } };
