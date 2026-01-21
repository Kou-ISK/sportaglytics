import React from 'react';
import {
  IconButton,
  Menu,
  MenuItem,
  Paper,
  Stack,
  Tooltip,
  Typography,
  ListItemIcon,
  Divider,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import {
  FileDownload,
  FolderOpen,
  MoreVert,
  PlaylistPlay,
  Save,
} from '@mui/icons-material';

type ViewMode = 'angle1' | 'angle2' | 'dual';

type PlaylistHeaderToolbarProps = {
  playlistName: string;
  hasUnsavedChanges: boolean;
  exportDisabled: boolean;
  hasDualSources: boolean;
  anchorEl: HTMLElement | null;
  onMenuOpen: (event: React.MouseEvent<HTMLElement>) => void;
  onMenuClose: () => void;
  onSaveClick: () => void;
  onSaveAsClick: () => void;
  onLoadClick: () => void;
  onExportClick: () => void;
  onViewModeChange: (mode: ViewMode) => void;
};

export const PlaylistHeaderToolbar = ({
  playlistName,
  hasUnsavedChanges,
  exportDisabled,
  hasDualSources,
  anchorEl,
  onMenuOpen,
  onMenuClose,
  onSaveClick,
  onSaveAsClick,
  onLoadClick,
  onExportClick,
  onViewModeChange,
}: PlaylistHeaderToolbarProps) => {
  const theme = useTheme();

  return (
    <Paper
      elevation={0}
      sx={{
        bgcolor: theme.palette.background.paper,
        backdropFilter: 'blur(8px)',
        borderBottom: '1px solid',
        borderColor: theme.palette.divider,
        px: 1.5,
        py: 0.75,
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1}>
        <PlaylistPlay sx={{ color: theme.palette.primary.main }} />
        <Typography variant="subtitle2" sx={{ flex: 1 }}>
          {playlistName}
          {hasUnsavedChanges ? ' *' : ''}
        </Typography>

        <Tooltip
          title={`保存 (Cmd+S)${hasUnsavedChanges ? ' - 未保存の変更あり' : ''}`}
        >
          <IconButton
            size="small"
            onClick={onSaveClick}
            sx={{
              color: hasUnsavedChanges ? 'warning.main' : 'text.secondary',
              boxShadow: hasUnsavedChanges
                ? '0 0 8px rgba(255, 111, 97, 0.6)'
                : 'none',
              transition: 'all 0.3s ease',
              '&:hover': {
                bgcolor: hasUnsavedChanges
                  ? alpha(theme.palette.warning.main, 0.1)
                  : alpha(theme.palette.action.hover, 0.08),
              },
            }}
          >
            <Save fontSize="small" />
          </IconButton>
        </Tooltip>

        <Tooltip title="書き出し (Cmd+E)">
          <IconButton
            size="small"
            onClick={onExportClick}
            disabled={exportDisabled}
            sx={{
              color: 'text.secondary',
              '&:hover': { bgcolor: alpha(theme.palette.action.hover, 0.08) },
            }}
          >
            <FileDownload fontSize="small" />
          </IconButton>
        </Tooltip>

        <IconButton size="small" onClick={onMenuOpen}>
          <MoreVert fontSize="small" />
        </IconButton>
        <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={onMenuClose}>
          <MenuItem
            onClick={() => {
              onMenuClose();
              onSaveAsClick();
            }}
          >
            <ListItemIcon>
              <Save fontSize="small" />
            </ListItemIcon>
            名前を付けて保存...
          </MenuItem>
          <MenuItem
            onClick={() => {
              onMenuClose();
              onLoadClick();
            }}
          >
            <ListItemIcon>
              <FolderOpen fontSize="small" />
            </ListItemIcon>
            プレイリストを開く
          </MenuItem>
          <Divider />
          <MenuItem
            onClick={() => {
              onMenuClose();
              onViewModeChange('angle1');
            }}
            disabled={!hasDualSources}
          >
            <ListItemIcon>
              <Typography variant="caption">⇧1</Typography>
            </ListItemIcon>
            アングル1のみ
          </MenuItem>
          <MenuItem
            onClick={() => {
              onMenuClose();
              onViewModeChange('angle2');
            }}
            disabled={!hasDualSources}
          >
            <ListItemIcon>
              <Typography variant="caption">⇧2</Typography>
            </ListItemIcon>
            アングル2のみ
          </MenuItem>
          <MenuItem
            onClick={() => {
              onMenuClose();
              onViewModeChange('dual');
            }}
            disabled={!hasDualSources}
          >
            <ListItemIcon>
              <Typography variant="caption"> </Typography>
            </ListItemIcon>
            デュアルビュー
          </MenuItem>
        </Menu>
      </Stack>
    </Paper>
  );
};
