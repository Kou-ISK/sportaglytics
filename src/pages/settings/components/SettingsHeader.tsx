import React from 'react';
import { AppBar, Toolbar, Typography, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

interface SettingsHeaderProps {
  onClose: () => void;
}

export const SettingsHeader: React.FC<SettingsHeaderProps> = ({ onClose }) => {
  return (
    <AppBar position="static" color="default" elevation={1}>
      <Toolbar>
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          設定
        </Typography>
        <IconButton
          edge="end"
          color="inherit"
          onClick={onClose}
          aria-label="閉じる"
        >
          <CloseIcon />
        </IconButton>
      </Toolbar>
    </AppBar>
  );
};
