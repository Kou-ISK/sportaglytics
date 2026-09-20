import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box } from '@mui/material';
import { PitchCalibrationView } from './PitchCalibrationView';
const noop = (): void => {};
const meta = {
  title: 'Playlist/Paint/Pitch Calibration',
  component: PitchCalibrationView,
  decorators: [
    (Story) => (
      <Box sx={{ width: 280, p: 2 }}>
        <Story />
      </Box>
    ),
  ],
  args: {
    editing: true,
    calibrated: false,
    valid: true,
    distance: null,
    disabled: false,
    draft: {
      corners: [
        { x: 0.2, y: 0.2 },
        { x: 0.8, y: 0.2 },
        { x: 0.9, y: 0.8 },
        { x: 0.1, y: 0.8 },
      ],
      widthMeters: 70,
      lengthMeters: 100,
      region: { x: 0, y: 22, width: 70, length: 28 },
    },
    onBegin: noop,
    onCancel: noop,
    onApply: noop,
    onClear: noop,
    onCornerChange: noop,
    onSizeChange: noop,
    onRegionChange: noop,
    onAddZone: noop,
    onConfirmFrame: noop,
  },
} satisfies Meta<typeof PitchCalibrationView>;
export default meta;
type Story = StoryObj<typeof meta>;
export const PartialPitch: Story = {};
export const CameraMoved: Story = {
  args: { editing: false, calibrated: true, needsConfirmation: true },
};
export const InvalidPoints: Story = { args: { valid: false } };
