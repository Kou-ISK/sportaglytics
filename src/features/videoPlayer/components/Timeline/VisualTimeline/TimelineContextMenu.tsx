import React from 'react';
import {
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';

interface TimelineContextMenuProps {
  anchorPosition: { top: number; left: number } | null;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onJumpTo: () => void;
  onDuplicate: () => void;
  onAddToPlaylist?: () => void;
  selectedCount?: number;
}

export const TimelineContextMenu: React.FC<TimelineContextMenuProps> = ({
  anchorPosition,
  onClose,
  onEdit,
  onDelete,
  onJumpTo,
  onDuplicate,
  onAddToPlaylist,
  selectedCount = 1,
}) => {
  const handleEdit = () => {
    onEdit();
    onClose();
  };

  const handleDelete = () => {
    onDelete();
    onClose();
  };

  const handleJumpTo = () => {
    onJumpTo();
    onClose();
  };

  const handleDuplicate = () => {
    onDuplicate();
    onClose();
  };

  const handleAddToPlaylist = () => {
    onAddToPlaylist?.();
    onClose();
  };

  return (
    <Menu
      open={Boolean(anchorPosition)}
      onClose={onClose}
      anchorReference="anchorPosition"
      anchorPosition={anchorPosition || undefined}
      slotProps={{
        paper: {
          sx: {
            minWidth: 200,
          },
        },
      }}
    >
      <MenuItem onClick={handleJumpTo}>
        <ListItemIcon>
          <PlayArrowIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText primary="この位置へジャンプ" />
      </MenuItem>

      <MenuItem onClick={handleEdit}>
        <ListItemIcon>
          <EditIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText primary="編集" />
      </MenuItem>

      <MenuItem onClick={handleDuplicate}>
        <ListItemIcon>
          <ContentCopyIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText primary="複製" />
      </MenuItem>

      {onAddToPlaylist && (
        <MenuItem onClick={handleAddToPlaylist}>
          <ListItemIcon>
            <PlaylistAddIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary={
              selectedCount > 1
                ? `プレイリストに追加 (${selectedCount}件)`
                : 'プレイリストに追加'
            }
          />
        </MenuItem>
      )}

      <Divider />

      <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
        <ListItemIcon>
          <DeleteIcon fontSize="small" color="error" />
        </ListItemIcon>
        <ListItemText primary="削除" />
      </MenuItem>
    </Menu>
  );
};
