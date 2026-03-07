import React from 'react';
import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import KeyboardIcon from '@mui/icons-material/Keyboard';
import DeleteIcon from '@mui/icons-material/Delete';

interface ButtonHotkeyFieldProps {
  capturedHotkey: string;
  isCapturingHotkey: boolean;
  setIsCapturingHotkey: (value: boolean) => void;
  onClear: () => void;
}

export const ButtonHotkeyField = ({
  capturedHotkey,
  isCapturingHotkey,
  setIsCapturingHotkey,
  onClear,
}: ButtonHotkeyFieldProps) => {
  return (
    <>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        ホットキー
      </Typography>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: 'block', mb: 1 }}
      >
        ボタンを起動するショートカットキー（Shift+キーで2チーム目）
      </Typography>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        <Box
          onClick={() => setIsCapturingHotkey(true)}
          sx={{
            flex: 1,
            p: 1.5,
            border: '1px solid',
            borderColor: isCapturingHotkey ? 'primary.main' : 'divider',
            borderRadius: 1,
            backgroundColor: isCapturingHotkey ? 'action.selected' : 'background.paper',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            '&:hover': {
              borderColor: 'primary.main',
            },
          }}
        >
          <KeyboardIcon
            fontSize="small"
            color={isCapturingHotkey ? 'primary' : 'action'}
          />
          <Typography
            variant="body2"
            color={
              isCapturingHotkey
                ? 'primary'
                : capturedHotkey
                  ? 'text.primary'
                  : 'text.secondary'
            }
            sx={{ fontFamily: 'monospace' }}
          >
            {isCapturingHotkey ? 'キーを押してください...' : capturedHotkey || '未設定'}
          </Typography>
        </Box>
        {capturedHotkey && (
          <Tooltip title="ホットキーをクリア">
            <IconButton size="small" onClick={onClear}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Box>
      {isCapturingHotkey && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ mt: 0.5, display: 'block' }}
        >
          Escでキャンセル
        </Typography>
      )}
    </>
  );
};
