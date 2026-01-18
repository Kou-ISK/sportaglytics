import React from 'react';
import { Box, Paper, TextField } from '@mui/material';

type AnnotationTextInputOverlayProps = {
  width: number;
  height: number;
  textPosition: { x: number; y: number };
  textInput: string;
  color: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
};

export const AnnotationTextInputOverlay = ({
  width,
  height,
  textPosition,
  textInput,
  color,
  onChange,
  onSubmit,
  onCancel,
}: AnnotationTextInputOverlayProps) => {
  return (
    <Box
      sx={{
        position: 'absolute',
        left: `${(textPosition.x / width) * 100}%`,
        top: `${(textPosition.y / height) * 100}%`,
        transform: 'translate(-50%, 0)',
        zIndex: 10,
      }}
    >
      <Paper sx={{ p: 1, bgcolor: 'transparent' }}>
        <TextField
          size="small"
          autoFocus
          value={textInput}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') onSubmit();
            if (event.key === 'Escape') onCancel();
          }}
          placeholder="テキストを入力..."
          sx={{
            minWidth: 150,
            backgroundColor: 'transparent',
            '& .MuiInputBase-input': {
              color: color,
              caretColor: color,
              fontSize: '24px',
              lineHeight: 1,
            },
            '& .MuiOutlinedInput-notchedOutline': {
              border: 'none',
            },
            '& .MuiInputBase-input:focus': {
              outline: 'none',
              boxShadow: '0 0 0 3px rgba(255,255,255,0.08)',
            },
          }}
        />
      </Paper>
    </Box>
  );
};
