import { DEFAULT_CLIP_EXPORT_OVERLAY_SETTINGS } from '../../../../../shared/clipExport/clipExportTypes';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { TimelineClipExportDialog } from './TimelineClipExportDialog';

const noop = (): void => undefined;
const meta = {
  title: 'Workspace/Timeline/ClipExport',
  component: TimelineClipExportDialog,
  args: {
    open: true,
    onClose: noop,
    onExport: noop,
    overlayChoice: null,
    onOverlayChoice: noop,
    overlaySettings: DEFAULT_CLIP_EXPORT_OVERLAY_SETTINGS,
    setOverlaySettings: noop,
    notePreview: '外側のスペースを確認\nサポートの位置を修正',
    exportScope: 'all',
    setExportScope: noop,
    selectedCount: 2,
    exportMode: 'single',
    setExportMode: noop,
    exportFileName: '',
    setExportFileName: noop,
    angleOption: 'single',
    setAngleOption: noop,
    selectedAngleIndex: 0,
    setSelectedAngleIndex: noop,
    videoSources: ['videos/angle-1.mp4', 'videos/angle-2.mp4'],
    primarySource: 'videos/angle-1.mp4',
    secondarySource: 'videos/angle-2.mp4',
    setPrimarySource: noop,
    setSecondarySource: noop,
  },
} satisfies Meta<typeof TimelineClipExportDialog>;
export default meta;
type Story = StoryObj<typeof meta>;
export const AwaitingChoice: Story = {};
export const OriginalPicture: Story = { args: { overlayChoice: false } };
export const WithOverlay: Story = { args: { overlayChoice: true } };
