import React from 'react';
import { Box, Button, Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import LabelIcon from '@mui/icons-material/Label';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SaveIcon from '@mui/icons-material/Save';
import SaveAsIcon from '@mui/icons-material/SaveAs';

export type CodingPanelWindowMode = 'code' | 'label' | 'edit';
export const CODING_PANEL_WINDOW_CREATION_ACTIONS_ID =
  'coding-panel-window-creation-actions';

interface CodingPanelWindowToolbarProps {
  mode: CodingPanelWindowMode;
  title: string;
  canSave: boolean;
  onModeChange: (
    event: React.MouseEvent<HTMLElement>,
    mode: CodingPanelWindowMode | null,
  ) => void;
  onSave: () => void;
  onSaveAs: () => void;
}

export const CodingPanelWindowToolbar = ({
  mode,
  title,
  canSave,
  onModeChange,
  onSave,
  onSaveAs,
}: CodingPanelWindowToolbarProps): React.ReactElement => {
  return (
    <Stack
      direction="row"
      spacing={1}
      alignItems="center"
      sx={{
        px: 1,
        py: 0.75,
        borderBottom: '1px solid',
        borderColor: 'divider',
      }}
    >
      <ToggleButtonGroup
        exclusive
        size="small"
        value={mode}
        onChange={onModeChange}
      >
        <ToggleButton value="code" aria-label="コード">
          <PlayArrowIcon fontSize="small" />
        </ToggleButton>
        <ToggleButton value="label" aria-label="ラベル">
          <LabelIcon fontSize="small" />
        </ToggleButton>
        <ToggleButton value="edit" aria-label="編集">
          <EditIcon fontSize="small" />
        </ToggleButton>
      </ToggleButtonGroup>
      <Typography variant="body2" color="text.secondary" noWrap>
        {title}
      </Typography>
      {mode === 'edit' && (
        <Stack
          id={CODING_PANEL_WINDOW_CREATION_ACTIONS_ID}
          direction="row"
          spacing={0.25}
          alignItems="center"
        />
      )}
      <Box sx={{ flex: 1 }} />
      {mode === 'edit' && (
        <>
          <Button
            size="small"
            startIcon={<SaveIcon />}
            disabled={!canSave}
            onClick={onSave}
            sx={{
              minHeight: 24,
              px: 0.75,
              py: 0.125,
              fontSize: '0.7rem',
              lineHeight: 1.1,
              '& .MuiButton-startIcon': { mr: 0.25 },
              '& .MuiSvgIcon-root': { fontSize: 14 },
            }}
          >
            保存
          </Button>
          <Button
            size="small"
            startIcon={<SaveAsIcon />}
            disabled={!canSave}
            onClick={onSaveAs}
            sx={{
              minHeight: 24,
              px: 0.75,
              py: 0.125,
              fontSize: '0.7rem',
              lineHeight: 1.1,
              '& .MuiButton-startIcon': { mr: 0.25 },
              '& .MuiSvgIcon-root': { fontSize: 14 },
            }}
          >
            別名保存
          </Button>
        </>
      )}
    </Stack>
  );
};
