import React from 'react';
import {
  Box,
  IconButton,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
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

const compactIconButtonSx = {
  width: 30,
  height: 30,
  p: 0.5,
} as const;

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
      spacing={0.5}
      alignItems="center"
      sx={{
        minHeight: 36,
        px: 0.5,
        py: 0.25,
        borderBottom: '1px solid',
        borderColor: 'divider',
      }}
    >
      <ToggleButtonGroup
        exclusive
        size="small"
        value={mode}
        onChange={onModeChange}
        sx={{
          flexShrink: 0,
          '& .MuiToggleButton-root': {
            minWidth: 30,
            width: 30,
            height: 30,
            p: 0.5,
          },
        }}
      >
        <Tooltip title="コードモード">
          <ToggleButton value="code" aria-label="コード">
            <PlayArrowIcon fontSize="small" />
          </ToggleButton>
        </Tooltip>
        <Tooltip title="ラベルモード">
          <ToggleButton value="label" aria-label="ラベル">
            <LabelIcon fontSize="small" />
          </ToggleButton>
        </Tooltip>
        <Tooltip title="編集モード">
          <ToggleButton value="edit" aria-label="編集">
            <EditIcon fontSize="small" />
          </ToggleButton>
        </Tooltip>
      </ToggleButtonGroup>
      <Typography
        variant="caption"
        color="text.secondary"
        noWrap
        sx={{ minWidth: 0 }}
      >
        {title}
      </Typography>
      {mode === 'edit' && (
        <Stack
          id={CODING_PANEL_WINDOW_CREATION_ACTIONS_ID}
          direction="row"
          spacing={0}
          alignItems="center"
          sx={{ flexShrink: 0 }}
        />
      )}
      <Box sx={{ flex: 1, minWidth: 0 }} />
      {mode === 'edit' && (
        <>
          <Tooltip title="保存">
            <span>
              <IconButton
                size="small"
                disabled={!canSave}
                onClick={onSave}
                aria-label="保存"
                sx={compactIconButtonSx}
              >
                <SaveIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="別名保存">
            <span>
              <IconButton
                size="small"
                disabled={!canSave}
                onClick={onSaveAs}
                aria-label="別名保存"
                sx={compactIconButtonSx}
              >
                <SaveAsIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </>
      )}
    </Stack>
  );
};
