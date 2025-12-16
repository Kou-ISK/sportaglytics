import React, { useState } from 'react';
import {
  Box,
  Button,
  Typography,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
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

  const generateDefaultName = () => {
    const base = 'プレイリスト';
    const names = new Set(state.playlists.map((p) => p.name));
    if (!names.has(base)) return base;
    let suffix = state.playlists.length + 1;
    let candidate = `${base} ${suffix}`;
    while (names.has(candidate)) {
      suffix += 1;
      candidate = `${base} ${suffix}`;
    }
    return candidate;
  };

  const handleAddToExisting = (playlistId: string) => {
    addItemsFromTimeline(playlistId, items);
    onClose();
  };

  const handleCreateNew = () => {
    const defaultName = generateDefaultName();
    const playlist = createPlaylist(defaultName);
    addItemsFromTimeline(playlist.id, items);
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
      {/* 名前入力は保存時に行うため、ここではダイアログを表示しない */}
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
