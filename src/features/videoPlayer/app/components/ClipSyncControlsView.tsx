import type { ReactElement } from 'react';
import type { ReactNode } from 'react';
import {
  Alert,
  Box,
  Button,
  MenuItem,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import Sync from '@mui/icons-material/Sync';
import GraphicEq from '@mui/icons-material/GraphicEq';
import Link from '@mui/icons-material/Link';
import LinkOff from '@mui/icons-material/LinkOff';
import { ClipSyncTimelineView } from './ClipSyncTimelineView';
import type { SyncTimelineItem } from './ClipSyncTimelineView';

export interface ClipSyncControlsViewProps {
  referencePreview: ReactNode;
  targetPreview: ReactNode;
  clips: SyncTimelineItem[];
  referenceId: string;
  targetId: string;
  referencePoint: number;
  targetPoint: number;
  message: string;
  isApplying: boolean;
  isAnalyzing: boolean;
  ready: boolean;
  linked: boolean;
  canLink: boolean;
  hasChanges: boolean;
  frameRate: number;
  onFrameRate: (rate: number) => void;
  onLink: () => void;
  onPlace: () => void;
  onRefineAudio: () => void;
  onApply: () => void;
  onCancel: () => void;
  onReset: () => void;
  onSelect: (clipId: string) => void;
  onMoveTarget: (seconds: number) => void;
}

export const ClipSyncControlsView = (
  props: ClipSyncControlsViewProps,
): ReactElement => {
  const busy = props.isApplying || props.isAnalyzing;
  return (
    <Box
      aria-label="クリップ同期ワークスペース"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: 420,
        height: '100%',
        bgcolor: 'background.default',
        minWidth: 0,
        '& .MuiButton-root': { whiteSpace: 'nowrap', flexShrink: 0 },
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{
          px: 1.5,
          py: 1,
          borderBottom: '1px solid',
          borderColor: 'divider',
          flexWrap: 'wrap',
          rowGap: 0.5,
        }}
      >
        <Box sx={{ flex: 1, minWidth: 240 }}>
          <Typography variant="subtitle2">クリップ単位シンク</Typography>
          <Typography variant="caption" color="text.secondary">
            両方の映像を同じ瞬間で止めて、フレームを合わせます。
          </Typography>
        </Box>
        <Button disabled={props.isApplying} onClick={props.onCancel}>
          {props.isAnalyzing ? '解析をキャンセル' : 'キャンセル'}
        </Button>
        <Button
          variant="contained"
          disabled={busy || !props.clips.length}
          onClick={props.onApply}
        >
          {props.isApplying ? '保存中…' : '同期を適用'}
        </Button>
      </Stack>
      {!props.clips.length ? (
        <Alert severity="info">
          パッケージに映像クリップを追加すると、同期を調整できます。
        </Alert>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
            gap: 1,
            p: 1,
            flex: 1,
            minHeight: 235,
          }}
        >
          {props.referencePreview}
          {props.targetPreview}
        </Box>
      )}
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{ px: 1.5, pb: 1, flexWrap: 'wrap', rowGap: 0.5 }}
      >
        <Button
          variant="contained"
          startIcon={<Sync />}
          disabled={
            busy || !props.ready || props.referenceId === props.targetId
          }
          onClick={props.onPlace}
        >
          この位置で配置
        </Button>
        <Button
          startIcon={props.linked ? <Link /> : <LinkOff />}
          aria-pressed={props.linked}
          disabled={busy || !props.canLink}
          onClick={props.onLink}
        >
          連動プレビュー
        </Button>
        <Button
          startIcon={<GraphicEq />}
          disabled={
            busy || !props.ready || props.referenceId === props.targetId
          }
          onClick={props.onRefineAudio}
        >
          {props.isAnalyzing ? '音声を解析中…' : '音声で微調整'}
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button disabled={busy || !props.hasChanges} onClick={props.onReset}>
          配置をリセット
        </Button>
      </Stack>
      {props.message && (
        <Alert severity="info" sx={{ mx: 1.5, mb: 1, py: 0 }}>
          {props.message}
        </Alert>
      )}
      <ClipSyncTimelineView {...props} busy={busy} />
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{ px: 1.5, py: 0.5 }}
      >
        <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
          選択した映像: Space 再生/停止 · ← → コマ送り · Shift＋← → 1秒
        </Typography>
        <Typography variant="caption" id="clip-sync-step-label">
          コマ送り
        </Typography>
        <Select
          size="small"
          labelId="clip-sync-step-label"
          value={props.frameRate}
          onChange={(event) => props.onFrameRate(Number(event.target.value))}
          sx={{ fontSize: 12, '& .MuiSelect-select': { py: 0.5 } }}
        >
          {[24, 25, 30, 50, 60].map((rate) => (
            <MenuItem key={rate} value={rate}>
              {rate}fps換算
            </MenuItem>
          ))}
        </Select>
      </Stack>
    </Box>
  );
};
