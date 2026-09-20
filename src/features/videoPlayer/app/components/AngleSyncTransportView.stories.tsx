import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { AngleSyncTransportView } from './AngleSyncTransportView';

const meta = {
  title: 'Features/VideoPlayer/AngleSync/TimelineTools',
  component: AngleSyncTransportView,
  parameters: { layout: 'fullscreen' },
  args: {
    time: 25,
    playing: false,
    onSeek: fn(),
    onCommand: fn(),
    state: {
      angles: [
        { name: 'Angle 1', point: 25, clips: [{ start: 0, end: 30 }] },
        {
          name: 'Angle 2',
          point: 10,
          clips: [
            { start: 0, end: 10 },
            { start: 10, end: 15 },
          ],
        },
      ],
      selected: 1,
      busy: false,
      saving: false,
      analyzing: false,
      changed: false,
      canMark: true,
      canAlign: true,
      frameAvailable: true,
      message: '',
    },
  },
} satisfies Meta<typeof AngleSyncTransportView>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Ready: Story = {};
export const Compact: Story = {
  decorators: [
    (Story) => (
      <div style={{ width: 740 }}>
        <Story />
      </div>
    ),
  ],
};
export const Error: Story = {
  args: {
    state: {
      ...meta.args.state,
      message:
        '同期を保存できませんでした。パッケージの接続を確認して再試行してください。',
      changed: true,
    },
  },
};
export const Saving: Story = {
  args: { state: { ...meta.args.state, busy: true, saving: true } },
};
