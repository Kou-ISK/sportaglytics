import type { Meta, StoryObj } from '@storybook/react-vite';
import { ClipExportTextOptionsView } from './ClipExportTextOptionsView';
import { DEFAULT_CLIP_EXPORT_OVERLAY_SETTINGS } from '../../../shared/clipExport/clipExportTypes';
const meta = {
  title: 'Workspace/Export/TextConfirmation',
  component: ClipExportTextOptionsView,
  args: {
    overlayChoice: null,
    overlaySettings: DEFAULT_CLIP_EXPORT_OVERLAY_SETTINGS,
    onOverlayChoice: () => {},
    setOverlaySettings: () => {},
    notePreview: 'スクラム: 外側を確認\n次のサポートを早く',
  },
} satisfies Meta<typeof ClipExportTextOptionsView>;
export default meta;
type Story = StoryObj<typeof meta>;
export const AwaitingChoice: Story = {};
export const IncludeNotes: Story = { args: { overlayChoice: true } };
export const Exclude: Story = { args: { overlayChoice: false } };
export const Narrow: Story = {
  ...IncludeNotes,
  decorators: [
    (Story) => (
      <div style={{ width: 300 }}>
        <Story />
      </div>
    ),
  ],
};
