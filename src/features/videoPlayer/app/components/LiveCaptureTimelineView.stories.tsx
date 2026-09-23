import type { Meta, StoryObj } from '@storybook/react-vite';
import { LiveCaptureTimelineView } from './LiveCaptureTimelineView';
const meta = {
  title: 'Capture/Timeline',
  component: LiveCaptureTimelineView,
  args: {
    state: { availableEndSeconds: 120, following: true, interrupted: false },
    onGoLive: () => {},
    onShowCapture: () => {},
  },
} satisfies Meta<typeof LiveCaptureTimelineView>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Live: Story = {};
export const Reviewing: Story = {
  args: {
    state: { availableEndSeconds: 120, following: false, interrupted: false },
  },
};
export const Interrupted: Story = {
  args: {
    state: { availableEndSeconds: 120, following: false, interrupted: true },
  },
};
