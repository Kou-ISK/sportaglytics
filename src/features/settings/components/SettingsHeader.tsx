import React from 'react';
import { Box, Toolbar, Typography, IconButton, Tooltip } from '@mui/material';
import TuneIcon from '@mui/icons-material/Tune';
import CloseIcon from '@mui/icons-material/Close';

interface SettingsHeaderProps {
  onClose: () => void;
}

export const SettingsHeader = ({
  onClose,
}: SettingsHeaderProps): React.ReactElement => {
  return (
    <Box
      component="header"
      sx={{
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
      }}
    >
      <Toolbar sx={{ minHeight: '48px !important', gap: 1 }}>
        <TuneIcon sx={{ color: 'primary.main', mr: 1 }} />
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography variant="h6" noWrap>
            設定
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            アプリ全体の表示と操作を変更します
          </Typography>
        </Box>
        <Tooltip title="設定を閉じる">
          <IconButton
            edge="end"
            color="inherit"
            onClick={onClose}
            aria-label="閉じる"
          >
            <CloseIcon />
          </IconButton>
        </Tooltip>
      </Toolbar>
    </Box>
  );
};
