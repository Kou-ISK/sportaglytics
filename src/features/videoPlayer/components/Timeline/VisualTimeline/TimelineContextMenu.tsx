import React from 'react';
import {
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
} from '@mui/material';
import ContentCutIcon from '@mui/icons-material/ContentCut';
import JoinFullIcon from '@mui/icons-material/JoinFull';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';

export interface TimelineContextMenuProps {
  anchorPosition: { top: number; left: number } | null;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onJumpTo: () => void;
  onDuplicate: () => void;
  onSplit?: () => void;
  onMerge?: () => void;
  canSplit?: boolean;
  canMerge?: boolean;
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
  onSplit,
  onMerge,
  canSplit = false,
  canMerge = false,
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
            minWidth: 224,
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

      {onSplit && (
        <MenuItem
          disabled={!canSplit}
          onClick={() => {
            onSplit();
            onClose();
          }}
        >
          <ListItemIcon>
            <ContentCutIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary="再生位置で分割"
            secondary="1件を選択し、区間内へシーク"
          />
        </MenuItem>
      )}
      {onMerge && (
        <MenuItem
          disabled={!canMerge}
          onClick={() => {
            onMerge();
            onClose();
          }}
        >
          <ListItemIcon>
            <JoinFullIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary="選択を1区間に結合"
            secondary="同じ行の2件以上・間の空白も含む"
          />
        </MenuItem>
      )}

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

      <MenuItem
        onClick={handleDelete}
        sx={{
          color: (theme) =>
            theme.palette.mode === 'dark'
              ? theme.palette.error.light
              : theme.palette.error.dark,
        }}
      >
        <ListItemIcon>
          <DeleteIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText
          primary={
            selectedCount > 1 ? `選択した${selectedCount}件を削除` : '削除'
          }
        />
      </MenuItem>
    </Menu>
  );
};
