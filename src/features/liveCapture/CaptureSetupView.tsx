import type { ReactElement } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import StopIcon from '@mui/icons-material/Stop';
import type {
  CaptureSnapshot,
  CaptureStartRequest,
} from '../../types/liveCapture';
import type {
  CaptureDeviceOption,
  CaptureSourceDraft,
} from './captureViewTypes';
import { CaptureSourceView } from './CaptureSourceView';

export interface CaptureSetupViewProps {
  name: string;
  sources: CaptureSourceDraft[];
  devices: CaptureDeviceOption[];
  quality: CaptureStartRequest['quality'];
  snapshot: CaptureSnapshot | null;
  busy: boolean;
  error: string;
  networkAvailable: boolean | null;
  streams?: Record<string, MediaStream>;
  onNameChange: (value: string) => void;
  onSourcesChange: (value: CaptureSourceDraft[]) => void;
  onQualityChange: (value: CaptureStartRequest['quality']) => void;
  onRefreshDevices: () => void;
  onAddSource: () => void;
  onStart: () => void;
  onStop: () => void;
  onHide?: () => void;
  onRetry: (id: string) => void;
}

export const CaptureSetupView = (
  props: CaptureSetupViewProps,
): ReactElement => {
  const {
    name,
    sources,
    devices,
    quality,
    snapshot,
    busy,
    error,
    networkAvailable,
    streams,
  } = props;
  const active =
    snapshot?.phase === 'recording' || snapshot?.phase === 'stopping';
  return (
    <Stack
      component="main"
      aria-label="ライブキャプチャ"
      sx={{ height: '100vh', bgcolor: 'background.default', minWidth: 0 }}
    >
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{
          px: 3,
          py: 2,
          borderBottom: 1,
          borderColor: 'divider',
          flexShrink: 0,
        }}
      >
        <Box>
          <Typography variant="h6" component="h1">
            ライブキャプチャ
          </Typography>
          <Typography variant="body2" color="text.secondary">
            カメラを取り込みながら、いつものタイムラインでコーディング
          </Typography>
        </Box>
        {active && (
          <Chip
            color="error"
            size="small"
            label={snapshot.phase === 'stopping' ? '保存中' : 'REC'}
          />
        )}
      </Stack>
      <Stack
        role="region"
        aria-label="録画入力の設定"
        tabIndex={0}
        spacing={2.5}
        sx={{ p: 3, flex: 1, overflowY: 'auto', minHeight: 0 }}
      >
        {error && <Alert severity="error">{error}</Alert>}
        {snapshot?.message && (
          <Alert severity="warning">{snapshot.message}</Alert>
        )}
        {snapshot?.phase === 'completed' && (
          <Alert severity="success">
            録画を保存しました。通常のパッケージとして再生・編集・書き出しできます。
          </Alert>
        )}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            label="パッケージ名"
            value={name}
            size="small"
            disabled={active || busy}
            onChange={(event) => props.onNameChange(event.target.value)}
            sx={{ flex: 1 }}
            inputProps={{ maxLength: 100 }}
          />
          <TextField
            select
            label="録画画質"
            value={quality}
            size="small"
            disabled={active || busy}
            onChange={(event) => {
              if (
                event.target.value === '1080p' ||
                event.target.value === '720p'
              )
                props.onQualityChange(event.target.value);
            }}
            sx={{ minWidth: 180 }}
          >
            <MenuItem value="1080p">最大1080p / 30fps</MenuItem>
            <MenuItem value="720p">最大720p / 30fps</MenuItem>
          </TextField>
        </Stack>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
        >
          <Typography variant="subtitle2" component="h2">
            映像入力 · {sources.length} / 4
          </Typography>
          <Button
            size="small"
            onClick={props.onRefreshDevices}
            disabled={active || busy}
          >
            カメラ・音声を確認
          </Button>
        </Stack>
        {networkAvailable === false && (
          <Alert severity="warning">
            現在の映像処理ツールではIP入力を利用できません。USBカメラは利用できます。
          </Alert>
        )}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: 'minmax(0, 1fr)',
              md: 'repeat(2, minmax(0, 1fr))',
            },
            gap: 2,
          }}
        >
          {sources.map((source) => (
            <CaptureSourceView
              key={source.id}
              source={source}
              devices={devices}
              disabled={active || busy}
              removable={sources.length > 1}
              canRetry={!busy && snapshot?.phase === 'recording'}
              stream={streams?.[source.id]}
              status={snapshot?.inputs.find((input) => input.id === source.id)}
              onChange={(updated) =>
                props.onSourcesChange(
                  sources.map((item) =>
                    item.id === source.id ? updated : item,
                  ),
                )
              }
              onRemove={() =>
                props.onSourcesChange(
                  sources.filter((item) => item.id !== source.id),
                )
              }
              onRetry={() => props.onRetry(source.id)}
            />
          ))}
        </Box>
        {!active && sources.length < 4 && (
          <Button
            startIcon={<AddIcon />}
            onClick={props.onAddSource}
            disabled={busy}
            sx={{ alignSelf: 'flex-start' }}
          >
            映像入力を追加
          </Button>
        )}
        <Divider />
        <Typography variant="body2" color="text.secondary">
          HDMIカメラはUSBキャプチャ機器へ接続します。iPhoneはMacの連係カメラ、またはIP配信ができるカメラアプリを使います。WindowsではOSにカメラとして認識される入力やIP映像を利用できます。
        </Typography>
        <Typography variant="body2" color="text.secondary">
          入力の録画準備が整うと映像とタイムラインが開きます。録画を続けたまま過去へシークでき、「ライブ位置」で各入力が保存できた最新位置へ戻れます。機器や配信による遅延に加え、保存確定まで数秒かかります。
        </Typography>
      </Stack>
      <Stack
        direction="row"
        spacing={2}
        justifyContent="space-between"
        alignItems="center"
        sx={{
          px: 3,
          py: 2,
          bgcolor: 'background.paper',
          borderTop: 1,
          borderColor: 'divider',
          flexShrink: 0,
        }}
      >
        <Typography variant="caption" color="text.secondary">
          {active
            ? '映像とコードをローカルのパッケージに保存しています'
            : '保存先は録画開始時に選択します'}
        </Typography>
        {active && (
          <Button onClick={props.onHide} sx={{ whiteSpace: 'nowrap' }}>
            録画を続けて閉じる
          </Button>
        )}
        {active ? (
          <Button
            variant="contained"
            color="error"
            startIcon={<StopIcon />}
            disabled={busy || snapshot.phase === 'stopping'}
            onClick={props.onStop}
            sx={{ whiteSpace: 'nowrap' }}
          >
            停止して保存
          </Button>
        ) : (
          <Button
            variant="contained"
            startIcon={<FiberManualRecordIcon />}
            disabled={busy || !name.trim()}
            onClick={props.onStart}
            sx={{ whiteSpace: 'nowrap' }}
          >
            {busy ? '準備中…' : '録画を開始'}
          </Button>
        )}
      </Stack>
    </Stack>
  );
};
