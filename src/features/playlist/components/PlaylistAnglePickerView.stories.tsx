import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box } from '@mui/material';
import { PlaylistAnglePickerView } from './PlaylistAnglePickerView';

const meta = {
  title: 'Workspace/Playlist/Default angle',
  component: PlaylistAnglePickerView,
  decorators: [
    (Story) => (
      <Box sx={{ width: 240, p: 1 }}>
        <Story />
      </Box>
    ),
  ],
  args: { value: 'angle1', hasSecondary: true, onChange: () => {} },
} satisfies Meta<typeof PlaylistAnglePickerView>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Primary: Story = {};
export const Secondary: Story = { args: { value: 'angle2' } };
export const SingleCamera: Story = { args: { hasSecondary: false } };
export const Light: Story = { ...Secondary, globals: { themeMode: 'light' } };
