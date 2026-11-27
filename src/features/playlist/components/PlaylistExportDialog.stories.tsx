import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { DEFAULT_CLIP_EXPORT_OVERLAY_SETTINGS, type ClipExportScope } from '../../../shared/clipExport/clipExportTypes';
import { PlaylistExportDialog, type AngleOption, type ExportMode } from './PlaylistExportDialog';

function ExportExample({ slidesOnly = false }: { slidesOnly?: boolean }): React.ReactElement {
  const [name, setName] = useState('対戦レビュー');
  const [scope, setScope] = useState<ClipExportScope>('all');
  const [mode, setMode] = useState<ExportMode>('single');
  const [angle, setAngle] = useState<AngleOption>('defaultAngles');
  const [angleIndex, setAngleIndex] = useState(0);
  const [overlayChoice, setOverlayChoice] = useState<boolean | null>(null);
  const [overlaySettings, setOverlaySettings] = useState(DEFAULT_CLIP_EXPORT_OVERLAY_SETTINGS);
  const [content, setContent] = useState({ includeEffects: true, includeSlides: true });
  const videoCount = slidesOnly ? 0 : scope === 'all' ? 3 : 1;
  const slides = content.includeSlides ? 1 : 0;
  return (
    <PlaylistExportDialog
      open onClose={() => undefined} onExport={() => undefined}
      exportFileName={name} setExportFileName={setName}
      exportScope={scope} setExportScope={setScope} selectedItemCount={slidesOnly ? 1 : 2}
      exportMode={mode} setExportMode={setMode}
      angleOption={angle} setAngleOption={setAngle} selectedAngleIndex={angleIndex}
      setSelectedAngleIndex={setAngleIndex} videoSources={slidesOnly ? [] : ['wide.mp4', 'tight.mp4']}
      overlayChoice={overlayChoice} onOverlayChoice={setOverlayChoice}
      overlaySettings={overlaySettings} setOverlaySettings={setOverlaySettings}
      content={content} setContent={setContent} availableSlideCount={1}
      hasVideo={videoCount > 0} outputItemCount={videoCount + slides}
      rowSummary={videoCount + slides > 0 ? [{ id: 'lineout', name: '攻撃ラインアウト', hasVideo: videoCount > 0, count: videoCount + slides }] : []}
      disableExport={false}
    />
  );
}

const meta = {
  title: 'Playlist/MP4書き出し',
  component: ExportExample,
} satisfies Meta<typeof ExportExample>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Mixed: Story = {};
export const SlidesOnly: Story = { args: { slidesOnly: true } };
