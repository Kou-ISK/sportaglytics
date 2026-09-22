import type { ReactElement } from 'react';
import { Button, Chip, Stack, Tooltip } from '@mui/material';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import type { CaptureTimelineState } from '../../../../types/liveCapture';

export const LiveCaptureTimelineView = ({
  state,
  onGoLive,
}: {
  state: CaptureTimelineState;
  onGoLive: () => void;
}): ReactElement => (
  <Stack
    direction="row"
    spacing={0.75}
    alignItems="center"
    sx={{ ml: 'auto', flexShrink: 0 }}
  >
    <Chip
      size="small"
      color={state.interrupted ? 'warning' : 'error'}
      variant="outlined"
      label={state.interrupted ? '入力切断あり' : '録画中'}
    />
    <Tooltip
      describeChild
      title="最新の保存済み映像へ戻る（標準: Shift + Option/Alt + L）"
    >
      <Button
        size="small"
        variant={state.following ? 'contained' : 'outlined'}
        startIcon={<FiberManualRecordIcon fontSize="small" />}
        onClick={onGoLive}
        disabled={state.availableEndSeconds <= 0}
        sx={{ whiteSpace: 'nowrap' }}
      >
        ライブ位置
      </Button>
    </Tooltip>
  </Stack>
);
