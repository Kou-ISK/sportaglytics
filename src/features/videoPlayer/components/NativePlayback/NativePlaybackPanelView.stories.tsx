import type { Meta, StoryObj } from '@storybook/react-vite';
import { NativePlaybackPanelView } from './NativePlaybackPanelView';
const meta = {
  title: 'Video/NativePlaybackPanel',
  component: NativePlaybackPanelView,
  args: {
    mode: 'original',
    error: null,
    audioTracks: 3,
    audioTrack: 0,
    muted: true,
    onOriginal: () => undefined,
    onAudio: () => undefined,
    onMute: () => undefined,
  },
} satisfies Meta<typeof NativePlaybackPanelView>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Original: Story = {};
export const UnsupportedRate: Story = {
  args: { unavailableReason: 'この再生速度では互換再生を使用します。' },
};
export const Native: Story = { args: { mode: 'native' } };
export const Restoring: Story = { args: { mode: 'restoring' } };
export const Failed: Story = {
  args: {
    mode: 'failed',
    error: '原本への復帰を確認できないため停止しています。',
  },
};
