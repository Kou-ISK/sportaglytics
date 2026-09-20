import type { Meta, StoryObj } from '@storybook/react';
import { AngleSyncWorkspaceView } from './AngleSyncWorkspaceView';
import { AngleSyncPreviewView } from './AngleSyncPreviewView';

const meta = {
  title: 'Features/VideoPlayer/AngleSync/Video',
  component: AngleSyncWorkspaceView,
  parameters: { layout: 'fullscreen' },
  args: { angleCount: 2, selected: null, previews: null },
  render: (args) => (
    <div
      style={{
        height:
          args.angleCount === 2 && args.selected === null
            ? 'calc(100vw * 9 / 32 + 24px)'
            : 'calc(100vw * 9 / 16 + 24px)',
      }}
    >
      <AngleSyncWorkspaceView
        {...args}
        previews={Array.from({ length: args.angleCount }, (_, index) => (
          <AngleSyncPreviewView
            key={index}
            id={`fixture-${index}`}
            name={`Angle ${index + 1}`}
            time={25}
            pointTime={index === 0 ? 25 : null}
            gap={index === 1}
            ready
            error=""
            hidden={args.selected !== null && args.selected !== index}
          />
        ))}
      />
    </div>
  ),
} satisfies Meta<typeof AngleSyncWorkspaceView>;
export default meta;
type Story = StoryObj<typeof meta>;
export const TwoAngles: Story = {};
export const SingleAngle: Story = { args: { selected: 0 } };
export const FourAngles: Story = { args: { angleCount: 4 } };
export const Empty: Story = { args: { angleCount: 0 } };
