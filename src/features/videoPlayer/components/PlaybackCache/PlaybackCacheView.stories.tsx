import type { Meta, StoryObj } from '@storybook/react-vite';
import { PlaybackCacheView } from './PlaybackCacheView';

const meta = {
  title: 'Video/PlaybackCache',
  component: PlaybackCacheView,
  args: {
    status: {
      phase: 'original',
      progress: null,
      selected: 'original',
      error: null,
    },
    estimate: { seconds: 4500, bytes: 2000000000 },
    canPrepare: true,
    paused: true,
    onPrepare: () => undefined,
    onCancel: () => undefined,
    onUseOriginal: () => undefined,
    onUseCache: () => undefined,
    onRetryCleanup: () => undefined,
  },
} satisfies Meta<typeof PlaybackCacheView>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Original: Story = {};
export const Converting: Story = {
  args: {
    status: {
      phase: 'converting',
      progress: 0.4,
      selected: 'original',
      error: null,
    },
  },
};
export const Cancelling: Story = {
  args: {
    status: {
      phase: 'cancelling',
      progress: null,
      selected: 'original',
      error: null,
    },
  },
};
export const StopUnconfirmed: Story = {
  args: {
    status: {
      phase: 'cancelling',
      progress: null,
      selected: 'original',
      error: 'stop',
    },
  },
};
export const Ready: Story = {
  args: {
    status: {
      phase: 'ready',
      progress: null,
      selected: 'original',
      error: null,
    },
  },
};
export const Selected: Story = {
  args: {
    status: { phase: 'ready', progress: null, selected: 'cache', error: null },
  },
};
export const CleanupFailed: Story = {
  args: {
    status: {
      phase: 'failed',
      progress: null,
      selected: 'original',
      error: 'cleanup',
    },
  },
};
