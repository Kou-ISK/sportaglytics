import type { Meta, StoryObj } from '@storybook/react';
import { TimelineAngleTracksView } from './TimelineAngleTracksView';

const meta = {
  title: 'Features/VideoPlayer/AngleSync/Tracks',
  component: TimelineAngleTracksView,
  args: {
    timeToPosition: (time: number) => time * 20,
    state: {
      angles: [
        { name: 'Angle 1', point: 26, clips: [{ start: 0, end: 30 }] },
        {
          name: 'Angle 2',
          point: 26,
          clips: [
            { start: 0, end: 10 },
            { start: 25, end: 30 },
          ],
        },
      ],
      selected: 1,
      busy: false,
      saving: false,
      analyzing: false,
      changed: true,
      canMark: true,
      canAlign: true,
      frameAvailable: true,
      message: '',
    },
  },
  decorators: [
    (Story) => (
      <div style={{ width: 720 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TimelineAngleTracksView>;
export default meta;
type Story = StoryObj<typeof meta>;
export const UnequalClipCounts: Story = {};
