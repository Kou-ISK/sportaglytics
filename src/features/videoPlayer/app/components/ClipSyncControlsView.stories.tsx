import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box } from '@mui/material';
import { ClipSyncControlsView } from './ClipSyncControlsView';
import { ClipSyncPreviewView } from './ClipSyncPreviewView';
import type { RuntimeSyncClip } from '../hooks/sync/useClipTimelineSyncController';

const noop = (): void => undefined;
const clips: RuntimeSyncClip[] = ['A', 'B', 'C', 'D'].map((id, index) => ({
  id,
  angleId: index < 2 ? 'angle1' : 'angle2',
  angleName: index < 2 ? 'アングル1' : 'アングル2',
  source: `videos/${id}.mp4`,
  sourceKind: 'local',
  gapBeforeSeconds: 0,
  timelineStartSeconds: index % 2 ? 2400 : 0,
  durationSeconds: 2400,
}));
const preview = (
  label: string,
  clipId: string,
  error = '',
  busy = false,
  ready = true,
) => (
  <ClipSyncPreviewView
    id={`story-${clipId}`}
    label={label}
    clipId={clipId}
    clips={clips}
    active={clipId === 'A'}
    busy={busy}
    ready={ready && !error}
    playing={false}
    time={23.467}
    duration={2400}
    error={error}
    frameRate={30}
    onSelect={noop}
    onActivate={noop}
    onToggle={noop}
    onSeek={noop}
    onStep={noop}
  />
);
const meta = {
  title: 'VideoPlayer/ClipSyncWorkspace',
  component: ClipSyncControlsView,
  decorators: [
    (Story) => (
      <Box sx={{ height: '100vh', minHeight: 480 }}>
        <Story />
      </Box>
    ),
  ],
  args: {
    referencePreview: preview('基準', 'A'),
    targetPreview: preview('配置対象', 'C'),
    clips: clips.map((clip) => ({
      id: clip.id,
      name: `${clip.id}.mp4`,
      angleId: clip.angleId,
      angleName: clip.angleName,
      start: clip.timelineStartSeconds,
      duration: 2400,
      changed: false,
    })),
    referenceId: 'A',
    targetId: 'C',
    referencePoint: 23.467,
    targetPoint: 23.467,
    message: '',
    isApplying: false,
    isAnalyzing: false,
    ready: true,
    linked: false,
    canLink: true,
    hasChanges: false,
    frameRate: 30,
    onFrameRate: noop,
    onLink: noop,
    onPlace: noop,
    onRefineAudio: noop,
    onApply: noop,
    onCancel: noop,
    onReset: noop,
    onSelect: noop,
    onMoveTarget: noop,
  },
} satisfies Meta<typeof ClipSyncControlsView>;
export default meta;
type Story = StoryObj<typeof meta>;
export const TwoAngles: Story = {};
export const Aligned: Story = {
  args: {
    linked: true,
    hasChanges: true,
    message: '対象クリップを 2.000 秒へ配置しました。',
  },
};
export const MissingMedia: Story = {
  args: {
    ready: false,
    canLink: false,
    targetPreview: preview(
      '配置対象',
      'C',
      '映像を読み込めません。元ファイルの接続を確認してください。',
    ),
  },
};
export const Empty: Story = {
  args: { clips: [], ready: false, canLink: false },
};
export const Saving: Story = {
  args: {
    isApplying: true,
    referencePreview: preview('基準', 'A', '', true),
    targetPreview: preview('配置対象', 'C', '', true),
    message: 'クリップのタイムライン配置を保存しています。',
  },
};
export const Compact: Story = {
  parameters: { viewport: { defaultViewport: 'tablet' } },
};

export const Loading: Story = {
  args: {
    ready: false,
    canLink: false,
    referencePreview: preview('基準', 'A', '', false, false),
    targetPreview: preview('配置対象', 'C', '', false, false),
  },
};
