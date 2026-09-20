import { Alert, Button, LinearProgress } from '@mui/material';

export interface PlaylistMediaStatusViewProps {
  loading: boolean;
  error: string;
  onRetry: () => void;
}
export const PlaylistMediaStatusView = ({
  loading,
  error,
  onRetry,
}: PlaylistMediaStatusViewProps): React.JSX.Element | null => {
  if (error)
    return (
      <Alert
        severity="error"
        action={
          <Button color="inherit" onClick={onRetry}>
            再試行
          </Button>
        }
      >
        {error}
      </Alert>
    );
  if (loading)
    return <LinearProgress aria-label="映像の同期情報を読み込み中" />;
  return null;
};
