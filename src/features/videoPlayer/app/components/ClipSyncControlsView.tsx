import type { Dispatch, SetStateAction } from 'react';
import {
  Alert,
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import CancelIcon from '@mui/icons-material/Cancel';
import GraphicEqIcon from '@mui/icons-material/GraphicEq';
import SaveIcon from '@mui/icons-material/Save';
import SyncIcon from '@mui/icons-material/Sync';
import { MemoizedSingleVideoPlayer } from '../../components/Player/SingleVideoPlayer';
import type { RuntimeSyncClip } from '../hooks/sync/useClipTimelineSyncController';

interface ClipSyncControlsViewProps {
  clips: RuntimeSyncClip[];
  reference?: RuntimeSyncClip;
  target?: RuntimeSyncClip;
  referenceId: string;
  targetId: string;
  message: string;
  isApplying: boolean;
  isAnalyzing: boolean;
  setReferenceId: (clipId: string) => void;
  setTargetId: (clipId: string) => void;
  recordClipDuration: (clipId: string) => Dispatch<SetStateAction<number>>;
  onPlace: () => void;
  onRefineAudio: () => void;
  onApply: () => void;
  onCancel: () => void;
}

const clipLabel = (clip: RuntimeSyncClip): string => {
  const sourceName = clip.source.split(/[\\/]/).pop() || clip.source;
  return `${clip.angleName} — ${sourceName}`;
};

export const ClipSyncControlsView = ({
  clips,
  reference,
  target,
  referenceId,
  targetId,
  message,
  isApplying,
  isAnalyzing,
  setReferenceId,
  setTargetId,
  recordClipDuration,
  onPlace,
  onRefineAudio,
  onApply,
  onCancel,
}: ClipSyncControlsViewProps) => (
  <Box
    sx={{
      bgcolor: 'background.paper',
      border: '1px solid',
      borderColor: 'divider',
      borderRadius: 2,
      p: 2,
      width: 'min(1100px, 96vw)',
      boxShadow: 8,
    }}
  >
    <Stack spacing={1.5}>
      <Typography variant="subtitle1" fontWeight={700}>
        クリップ単位シンク
      </Typography>
      <Stack direction="row" spacing={1.5}>
        {[
          {
            label: '基準',
            clip: reference,
            id: 'sync_reference_clip',
            value: referenceId,
            onChange: setReferenceId,
          },
          {
            label: '配置対象',
            clip: target,
            id: 'sync_target_clip',
            value: targetId,
            onChange: setTargetId,
          },
        ].map((item) => (
          <Box key={item.label} sx={{ flex: 1 }}>
            <FormControl size="small" fullWidth sx={{ mb: 1 }}>
              <InputLabel>{item.label}クリップ</InputLabel>
              <Select
                label={`${item.label}クリップ`}
                value={item.value}
                onChange={(event) => item.onChange(event.target.value)}
              >
                {clips.map((clip) => (
                  <MenuItem key={clip.id} value={clip.id}>
                    {clipLabel(clip)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Box sx={{ position: 'relative', height: 150, bgcolor: 'black' }}>
              {item.clip && (
                <MemoizedSingleVideoPlayer
                  key={item.clip.id}
                  id={item.id}
                  videoSrc={item.clip.source}
                  isVideoPlaying={false}
                  videoPlayBackRate={1}
                  setMaxSec={recordClipDuration(item.clip.id)}
                  allowSeek
                />
              )}
            </Box>
          </Box>
        ))}
      </Stack>
      {message && <Alert severity="info">{message}</Alert>}
      <Stack direction="row" spacing={1}>
        <Button
          variant="contained"
          startIcon={<SyncIcon />}
          disabled={!reference || !target || reference.id === target.id}
          onClick={onPlace}
        >
          この位置で配置
        </Button>
        <Button
          startIcon={<GraphicEqIcon />}
          disabled={isAnalyzing || !reference || !target}
          onClick={onRefineAudio}
        >
          {isAnalyzing ? '15秒を解析中…' : '音声で微調整'}
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button startIcon={<CancelIcon />} onClick={onCancel}>
          {isAnalyzing ? '解析をキャンセル' : 'キャンセル'}
        </Button>
        <Button
          variant="contained"
          startIcon={<SaveIcon />}
          disabled={isApplying}
          onClick={onApply}
        >
          {isApplying ? '再合成中…' : '同期を適用'}
        </Button>
      </Stack>
    </Stack>
  </Box>
);
