import React from 'react';
import { Box, Toolbar, Typography, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

interface SettingsHeaderProps {
  onClose: () => void;
}

export const SettingsHeader = ({
  onClose,
}: SettingsHeaderProps): React.ReactElement => {
  return (
    <Box component="header" sx={{ borderBottom: 1, borderColor: 'divider' }}>
      <Toolbar sx={{ minHeight: '56px !important', gap: 1 }}>
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography variant="h6" noWrap>
            設定
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            アプリ全体の表示と操作を変更します
          </Typography>
        </Box>
        <IconButton
          edge="end"
          color="inherit"
          onClick={onClose}
          aria-label="閉じる"
        >
          <CloseIcon />
        </IconButton>
      </Toolbar>
    </Box>
  );
};
