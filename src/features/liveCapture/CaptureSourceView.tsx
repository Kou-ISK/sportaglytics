import type { ReactElement } from 'react';
import { useEffect, useRef } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import type { CaptureInputStatus } from '../../types/liveCapture';
import type {
  CaptureDeviceOption,
  CaptureSourceDraft,
} from './captureViewTypes';

export interface CaptureSourceViewProps {
  source: CaptureSourceDraft;
  devices: CaptureDeviceOption[];
  disabled: boolean;
  removable: boolean;
  canRetry?: boolean;
  status?: CaptureInputStatus;
  stream?: MediaStream;
  onChange: (source: CaptureSourceDraft) => void;
  onRemove: () => void;
  onRetry: () => void;
}

const phaseLabels = {
  connecting: '接続中',
  recording: '録画中',
  disconnected: '切断',
  stopped: '停止',
} as const;

export const CaptureSourceView = ({
  source,
  devices,
  disabled,
  removable,
  canRetry = false,
  status,
  stream,
  onChange,
  onRemove,
  onRetry,
}: CaptureSourceViewProps): ReactElement => {
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const element = video.current;
    if (!element) return;
    element.srcObject = stream ?? null;
    return () => {
      element.srcObject = null;
    };
  }, [stream]);
  return (
    <Box
      sx={{
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        p: 2,
        minWidth: 0,
      }}
    >
      <Stack spacing={1.5}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <TextField
            label="アングル名"
            size="small"
            value={source.name}
            disabled={disabled}
            onChange={(event) =>
              onChange({ ...source, name: event.target.value })
            }
            sx={{ flex: 1, minWidth: 0 }}
            inputProps={{ maxLength: 80 }}
          />
          {status && (
            <Chip
              size="small"
              label={phaseLabels[status.phase]}
              color={
                status.phase === 'recording'
                  ? 'error'
                  : status.phase === 'disconnected'
                    ? 'warning'
                    : 'default'
              }
            />
          )}
          {removable && !disabled && (
            <Tooltip title="入力を削除">
              <IconButton
                aria-label={`${source.name}を削除`}
                onClick={onRemove}
              >
                <CloseIcon />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
        <ToggleButtonGroup
          exclusive
          fullWidth
          size="small"
          value={source.kind}
          disabled={disabled}
          onChange={(_event, kind: unknown) => {
            if (kind === 'device' || kind === 'network')
              onChange({ ...source, kind });
          }}
        >
          <ToggleButton value="device">USB / HDMI / iPhone</ToggleButton>
          <ToggleButton value="network">IP映像</ToggleButton>
        </ToggleButtonGroup>
        {source.kind === 'device' ? (
          <>
            <TextField
              select
              fullWidth
              label="カメラ"
              slotProps={{
                inputLabel: { shrink: true },
                select: { displayEmpty: true },
              }}
              size="small"
              disabled={disabled}
              value={source.videoDeviceId}
              onChange={(event) =>
                onChange({ ...source, videoDeviceId: event.target.value })
              }
            >
              <MenuItem value="">既定のカメラ</MenuItem>
              {devices
                .filter((device) => device.kind === 'video')
                .map((device) => (
                  <MenuItem key={device.id} value={device.id}>
                    {device.name}
                  </MenuItem>
                ))}
            </TextField>
            <TextField
              select
              fullWidth
              label="音声入力"
              slotProps={{
                inputLabel: { shrink: true },
                select: { displayEmpty: true },
              }}
              size="small"
              disabled={disabled}
              value={source.audioDeviceId}
              onChange={(event) =>
                onChange({ ...source, audioDeviceId: event.target.value })
              }
            >
              <MenuItem value="">音声なし</MenuItem>
              {devices
                .filter((device) => device.kind === 'audio')
                .map((device) => (
                  <MenuItem key={device.id} value={device.id}>
                    {device.name}
                  </MenuItem>
                ))}
            </TextField>
          </>
        ) : (
          <TextField
            fullWidth
            label="配信URL"
            type="password"
            size="small"
            value={source.url}
            disabled={disabled}
            autoComplete="off"
            placeholder="rtsp://camera.example/live"
            helperText="RTSP / RTMP / HTTP(S) の映像・HLS。URLは保存しません。"
            onChange={(event) =>
              onChange({ ...source, url: event.target.value })
            }
          />
        )}
        {stream && (
          <Box
            component="video"
            ref={video}
            autoPlay
            muted
            playsInline
            sx={{
              width: '100%',
              aspectRatio: '16/9',
              bgcolor: 'background.default',
              objectFit: 'contain',
              maxHeight: 160,
            }}
          />
        )}
        {status && (
          <Typography variant="caption" color="text.secondary">
            保存済み {Math.floor(status.recordedSeconds / 60)}分
            {Math.floor(status.recordedSeconds % 60)}秒
          </Typography>
        )}
        {status?.message && (
          <Alert
            severity="warning"
            action={
              <Button size="small" disabled={!canRetry} onClick={onRetry}>
                再接続
              </Button>
            }
          >
            {status.message}
          </Alert>
        )}
      </Stack>
    </Box>
  );
};
