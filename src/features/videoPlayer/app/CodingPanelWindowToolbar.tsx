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
          <Tooltip title="保存">
            <span>
              <IconButton
                size="small"
                disabled={!canSave}
                onClick={onSave}
                aria-label="保存"
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
