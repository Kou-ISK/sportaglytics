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
      action={
        <Button color="inherit" onClick={feedback.onRetry}>
          {feedback.kind === 'load-error' ? '再読み込み' : '保存を再試行'}
        </Button>
      }
    >
      {feedback.message}
    </Alert>
  ) : null;
