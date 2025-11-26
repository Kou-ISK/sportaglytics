import React from 'react';
import { Alert, AlertTitle, Paper, Stack, Typography } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

interface DirectoryStepProps {
  packageName: string;
  selectedDirectory: string;
}

/**
 * Step 2: 保存先ディレクトリ選択の確認表示
 */
export const DirectoryStep: React.FC<DirectoryStepProps> = ({
  packageName,
  selectedDirectory,
}) => {
  return (
    <Stack spacing={3}>
      <Alert severity="info">
        <AlertTitle>パッケージの保存先を選択してください</AlertTitle>
        選択したフォルダ内に「{packageName || 'パッケージ'}」フォルダが作成されます
      </Alert>
      {selectedDirectory ? (
        <Paper variant="outlined" sx={{ p: 2, bgcolor: 'success.light' }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <CheckCircleIcon color="success" />
            <Typography variant="body2" noWrap>
              {selectedDirectory}
            </Typography>
          </Stack>
        </Paper>
      ) : (
        <Typography color="text.secondary">
          「次へ」をクリックして保存先を選択してください
        </Typography>
      )}
    </Stack>
  );
};
