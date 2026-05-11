import React from 'react';
import { Alert, Typography } from '@mui/material';

type CodeWindowPlaceholderAlertProps = {
  team1Placeholder: string;
  team2Placeholder: string;
};

export const CodeWindowPlaceholderAlert = ({
  team1Placeholder,
  team2Placeholder,
}: CodeWindowPlaceholderAlertProps) => {
  return (
    <Alert severity="info" sx={{ mb: 2 }}>
      <Typography variant="body2" fontWeight="bold" gutterBottom>
        チーム名プレースホルダー
      </Typography>
      <Typography variant="body2">
        ボタン名に <code>{team1Placeholder}</code> や{' '}
        <code>{team2Placeholder}</code> を使うと、パッケージ設定のチーム名に自動置換されます。
      </Typography>
      <Typography variant="body2" sx={{ mt: 0.5 }}>
        例: <code>{team1Placeholder} タックル</code> →{' '}
        <code>Japan タックル</code>（Team1が&quot;Japan&quot;の場合）
      </Typography>
    </Alert>
  );
};
