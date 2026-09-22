import type { ReactElement } from 'react';
import { Button, Stack, Typography } from '@mui/material';
import VideocamOutlined from '@mui/icons-material/VideocamOutlined';
import Add from '@mui/icons-material/Add';
import FolderOpenOutlined from '@mui/icons-material/FolderOpenOutlined';
export const ActionButtonsRow = ({
  onOpenPackage,
  onOpenWizard,
  onOpenCapture,
  disabled = false,
}: {
  onOpenPackage: () => void;
  onOpenWizard: () => void;
  onOpenCapture?: () => void;
  disabled?: boolean;
}): ReactElement => (
  <Stack spacing={1.5}>
    <Typography variant="overline" color="text.secondary">
      分析を始める
    </Typography>
    <Stack direction={{ xs: 'column', sm: 'row', md: 'column' }} spacing={1.5}>
      <Button
        variant="contained"
        startIcon={<FolderOpenOutlined />}
        onClick={onOpenPackage}
        disabled={disabled}
        fullWidth
        sx={{ justifyContent: 'flex-start', whiteSpace: 'nowrap', py: 1.25 }}
      >
        パッケージを開く
      </Button>
      <Button
        variant="outlined"
        startIcon={<Add />}
        onClick={onOpenWizard}
        disabled={disabled}
        fullWidth
        sx={{ justifyContent: 'flex-start', whiteSpace: 'nowrap', py: 1.25 }}
      >
        新しいパッケージを作成
      </Button>
      {onOpenCapture && (
        <Button
          variant="outlined"
          startIcon={<VideocamOutlined />}
          onClick={onOpenCapture}
          disabled={disabled}
          fullWidth
          sx={{ justifyContent: 'flex-start', whiteSpace: 'nowrap', py: 1.25 }}
        >
          ライブキャプチャ
        </Button>
      )}
    </Stack>
    <Typography variant="body2" color="text.secondary">
      初めて使う映像は「新しいパッケージを作成」から。試合映像とタグをまとめて管理できます。
    </Typography>
  </Stack>
);
