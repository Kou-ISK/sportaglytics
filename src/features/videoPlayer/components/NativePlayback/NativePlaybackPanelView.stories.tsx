import type { Meta, StoryObj } from '@storybook/react-vite';
import { NativePlaybackPanelView } from './NativePlaybackPanelView';
const meta = {
  title: 'Video/NativePlaybackPanel',
  component: NativePlaybackPanelView,
  args: {
    mode: 'original',
    canOpen: true,
    error: null,
    audioTracks: 3,
    audioTrack: 0,
    muted: true,
    onOpen: () => undefined,
    onOriginal: () => undefined,
    onAudio: () => undefined,
    onMute: () => undefined,
  },
} satisfies Meta<typeof NativePlaybackPanelView>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Original: Story = {};
export const UnsupportedRate: Story = {
  args: { canOpen: false, unavailableReason: 'この試用の再生速度は 1× です。' },
};
export const Native: Story = { args: { mode: 'native' } };
export const Restoring: Story = { args: { mode: 'restoring' } };
export const Failed: Story = {
  args: {
    mode: 'failed',
    error: '原本への復帰を確認できないため停止しています。',
  },
};
