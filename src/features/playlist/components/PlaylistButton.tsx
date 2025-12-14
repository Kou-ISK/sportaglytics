import React, { useState } from 'react';
import {
  Box,
  Button,
  Typography,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Tooltip,
  Chip,
} from '@mui/material';
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import AddIcon from '@mui/icons-material/Add';
import { usePlaylist } from '../../../contexts/PlaylistContext';
import type { TimelineData } from '../../../types/TimelineData';

interface AddToPlaylistMenuProps {
  /** メニューを開くアンカー要素 */
  anchorEl: HTMLElement | null;
  /** メニューを閉じるコールバック */
  onClose: () => void;
  /** 追加対象のタイムラインアイテム */
  items: TimelineData[];
}

/**
 * タイムラインアイテムをプレイリストに追加するメニュー
 */
export const AddToPlaylistMenu: React.FC<AddToPlaylistMenuProps> = ({
  anchorEl,
  onClose,
  items,
}) => {
  const { state, createPlaylist, addItemsFromTimeline, openPlaylistWindow } =
    usePlaylist();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');

  const handleAddToExisting = (playlistId: string) => {
    addItemsFromTimeline(playlistId, items);
    onClose();
  };

  const handleCreateNew = () => {
    setCreateDialogOpen(true);
  };

  const handleConfirmCreate = () => {
    if (!newPlaylistName.trim()) return;
    const playlist = createPlaylist(newPlaylistName.trim());
    addItemsFromTimeline(playlist.id, items);
    setCreateDialogOpen(false);
    setNewPlaylistName('');
    onClose();
  };

  const handleOpenWindow = async () => {
    await openPlaylistWindow();
    onClose();
  };

  return (
    <>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={onClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <MenuItem disabled sx={{ opacity: 1 }}>
          <Typography variant="caption" color="text.secondary">
            {items.length}件のアイテムを追加
          </Typography>
        </MenuItem>

        {state.playlists.length > 0 && (
          <Box>
            {state.playlists.map((playlist) => (
              <MenuItem
                key={playlist.id}
                onClick={() => handleAddToExisting(playlist.id)}
              >
                <ListItemIcon>
                  <PlaylistAddIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary={playlist.name}
                  secondary={`${playlist.items.length}件`}
                />
              </MenuItem>
            ))}
          </Box>
        )}

        <MenuItem onClick={handleCreateNew}>
          <ListItemIcon>
            <AddIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="新しいプレイリストを作成" />
        </MenuItem>

        <MenuItem onClick={handleOpenWindow}>
          <ListItemIcon>
            <OpenInNewIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="プレイリストウィンドウを開く" />
        </MenuItem>
      </Menu>

      {/* 新規作成ダイアログ */}
      <Dialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>新しいプレイリストを作成</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="プレイリスト名"
            value={newPlaylistName}
            onChange={(e) => setNewPlaylistName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleConfirmCreate();
            }}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>キャンセル</Button>
          <Button
            onClick={handleConfirmCreate}
            variant="contained"
            disabled={!newPlaylistName.trim()}
          >
            作成して追加
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

interface PlaylistButtonProps {
  /** 現在選択中のタイムラインアイテム */
  selectedItems: TimelineData[];
}

/**
 * プレイリスト操作ボタン（ツールバー用）
 */
export const PlaylistButton: React.FC<PlaylistButtonProps> = ({
  selectedItems,
}) => {
  const { openPlaylistWindow, isWindowOpen } = usePlaylist();
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    if (selectedItems.length > 0) {
      setMenuAnchor(event.currentTarget);
    } else {
      openPlaylistWindow();
    }
  };

  return (
    <>
      <Tooltip
        title={
          selectedItems.length > 0
            ? `${selectedItems.length}件をプレイリストに追加`
            : 'プレイリストを開く'
        }
      >
        <Button
          size="small"
          variant="outlined"
          startIcon={<PlaylistAddIcon />}
          onClick={handleClick}
          sx={{ minWidth: 'auto' }}
        >
          {selectedItems.length > 0 ? (
            <Chip
              label={selectedItems.length}
              size="small"
              sx={{ height: 18, ml: 0.5 }}
            />
          ) : isWindowOpen ? (
            <OpenInNewIcon fontSize="small" sx={{ ml: 0.5 }} />
          ) : null}
        </Button>
      </Tooltip>

      <AddToPlaylistMenu
        anchorEl={menuAnchor}
        onClose={() => setMenuAnchor(null)}
        items={selectedItems}
      />
    </>
  );
};

export default PlaylistButton;
