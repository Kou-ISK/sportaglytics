import type { ReactElement } from 'react';
import { Button, Stack, Typography } from '@mui/material';
import VideocamOutlined from '@mui/icons-material/VideocamOutlined';
import Add from '@mui/icons-material/Add';
import FolderOpenOutlined from '@mui/icons-material/FolderOpenOutlined';
export const ActionButtonsRow = ({
  onOpenPackage,
  onOpenWizard,
  onOpenCapture,
  onOpenLegacyPackage,
  onOpenSportscode,
  disabled = false,
}: {
  onOpenPackage: () => void;
  onOpenWizard: () => void;
  onOpenCapture?: () => void;
  onOpenLegacyPackage?: () => void;
  onOpenSportscode?: () => void;
  disabled?: boolean;
}): ReactElement => (
  <Stack spacing={1}>
    <Typography variant="subtitle2" color="text.secondary">
      分析を始める
    </Typography>
    <Stack spacing={1}>
      <Button
        variant="contained"
        startIcon={<FolderOpenOutlined />}
        onClick={onOpenPackage}
        disabled={disabled}
        fullWidth
        sx={{ justifyContent: 'flex-start', whiteSpace: 'nowrap' }}
      >
        パッケージを開く
      </Button>
      <Button
        variant="outlined"
        startIcon={<Add />}
        onClick={onOpenWizard}
        disabled={disabled}
        fullWidth
        sx={{ justifyContent: 'flex-start', whiteSpace: 'nowrap' }}
      >
        新しいパッケージを作成
      </Button>
      {onOpenCapture && (
        <Button
          variant="text"
          startIcon={<VideocamOutlined />}
          onClick={onOpenCapture}
          disabled={disabled}
          fullWidth
          sx={{ justifyContent: 'flex-start', whiteSpace: 'nowrap' }}
        >
          ライブキャプチャ
        </Button>
      )}
      {onOpenLegacyPackage && (
        <Button
          onClick={onOpenLegacyPackage}
          disabled={disabled}
          fullWidth
          sx={{ justifyContent: 'flex-start' }}
        >
          旧SporTagフォルダを開く
        </Button>
      )}
      {onOpenSportscode && (
        <Button
          onClick={onOpenSportscode}
          disabled={disabled}
          fullWidth
          sx={{ justifyContent: 'flex-start' }}
        >
          Sportscode XMLから作成
        </Button>
      )}
    </Stack>
  </Stack>
);
