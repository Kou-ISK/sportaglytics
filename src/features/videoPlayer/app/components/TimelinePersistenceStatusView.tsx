import { Alert, Button } from '@mui/material';
import type { ReactElement } from 'react';
import type { TimelinePersistenceFeedback } from '../hooks/useTimelinePersistence';

export const TimelinePersistenceStatusView = ({
  feedback,
}: {
  feedback: TimelinePersistenceFeedback | null;
}): ReactElement | null =>
  feedback ? (
    <Alert
      severity="error"
      sx={{ '& .MuiAlert-action': { flexShrink: 0 } }}
      action={
        <Button
          color="inherit"
          onClick={feedback.onRetry}
          sx={{ whiteSpace: 'nowrap' }}
        >
          {feedback.kind === 'load-error' ? '再読み込み' : '保存を再試行'}
        </Button>
      }
    >
      {feedback.message}
    </Alert>
  ) : null;
