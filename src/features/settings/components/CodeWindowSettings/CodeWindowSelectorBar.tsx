import React from 'react';
import {
  Box,
  Button,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Tooltip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteIcon from '@mui/icons-material/Delete';
import MoveToInboxIcon from '@mui/icons-material/MoveToInbox';
import OutboxIcon from '@mui/icons-material/Outbox';
import type { CodeWindowLayout } from '../../../../types/settings/coreTypes';

type CodeWindowSelectorBarProps = {
  codeWindows: CodeWindowLayout[];
  activeCodeWindowId: string | null;
  onSelect: (id: string | null) => void;
  onCreate: () => void;
  onDuplicate: (layout: CodeWindowLayout) => void;
  onExport: () => void;
  onDelete: (layoutId: string) => void;
  onImport: () => void;
  currentLayout: CodeWindowLayout | null;
  onClearSelection: () => void;
};

export const CodeWindowSelectorBar = ({
  codeWindows,
  activeCodeWindowId,
  onSelect,
  onCreate,
  onDuplicate,
  onExport,
  onDelete,
  onImport,
  currentLayout,
  onClearSelection,
}: CodeWindowSelectorBarProps) => {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
      }}
    >
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-end' }}>
        <FormControl sx={{ minWidth: 200 }}>
          <InputLabel>コードウィンドウ</InputLabel>
          <Select
            value={activeCodeWindowId || ''}
            label="コードウィンドウ"
            onChange={(event) => {
              onSelect(event.target.value || null);
              onClearSelection();
            }}
          >
            <MenuItem value="">
              <em>なし</em>
            </MenuItem>
            {codeWindows.map((cw) => (
              <MenuItem key={cw.id} value={cw.id}>
                {cw.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Button startIcon={<AddIcon />} variant="outlined" onClick={onCreate}>
          コードウィンドウを新規作成
        </Button>
        {currentLayout && (
          <>
            <Tooltip title="複製">
              <IconButton onClick={() => onDuplicate(currentLayout)}>
                <ContentCopyIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="エクスポート">
              <IconButton onClick={onExport}>
                <OutboxIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="削除">
              <IconButton
                color="error"
                onClick={() => onDelete(currentLayout.id)}
              >
                <DeleteIcon />
              </IconButton>
            </Tooltip>
          </>
        )}
        <Tooltip title="コードウィンドウをインポート">
          <IconButton onClick={onImport}>
            <MoveToInboxIcon />
          </IconButton>
        </Tooltip>
      </Box>
    </Paper>
  );
};
