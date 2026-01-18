import React, { useState } from 'react';
import {
  Button,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Chip,
} from '@mui/material';
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { usePlaylist } from '../../../contexts/PlaylistContext';
import type { TimelineData } from '../../../types/TimelineData';

interface AddToPlaylistMenuProps {
  /** メニューを開くアンカー要素 */
  anchorEl: HTMLElement | null;
  /** メニューを閉じるコールバック */
  onClose: () => void;
  /** 追加対象のタイムラインアイテム */
  items: TimelineData[];
  /** 現在の映像ソース（メイン/サブ） */
  videoList?: string[];
}

/**
 * タイムラインアイテムをプレイリストに追加するメニュー
 */
export const AddToPlaylistMenu: React.FC<AddToPlaylistMenuProps> = ({
  anchorEl,
  onClose,
  items,
  videoList,
}) => {
  const list = videoList || [];

  const handleAddToPlaylist = async () => {
    // 開いているプレイリストウィンドウ数を取得
    const count = await window.electronAPI?.playlist.getOpenWindowCount();

    if (count === 0) {
      // ウィンドウが開いていない場合は新規ウィンドウを作成
      await window.electronAPI?.playlist.openWindow();
    }

    // 全てのウィンドウにアイテムを追加
    for (const item of items) {
      const playlistItem = {
        id: crypto.randomUUID(),
        timelineItemId: item.id,
        actionName: item.actionName,
        startTime: item.startTime,
        endTime: item.endTime,
        labels: item.labels,
        memo: item.memo,
        addedAt: Date.now(),
        videoSource: list[0] || undefined,
        videoSource2: list[1] || undefined,
      };
      await window.electronAPI?.playlist.addItemToAllWindows(playlistItem);
    }
    onClose();
  };

  return (
    <Menu
      anchorEl={anchorEl}
      open={Boolean(anchorEl)}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
    >
      <MenuItem onClick={handleAddToPlaylist}>
        <ListItemIcon>
          <PlaylistAddIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText
          primary="プレイリストに追加"
          secondary={`${items.length}件のアイテム`}
        />
      </MenuItem>
    </Menu>
  );
};

interface PlaylistButtonProps {
  /** 現在選択中のタイムラインアイテム */
  selectedItems: TimelineData[];
  /** 現在の映像ソース（メイン/サブ） */
  videoList?: string[];
}

/**
 * プレイリスト操作ボタン（ツールバー用）
 */
export const PlaylistButton: React.FC<PlaylistButtonProps> = ({
  selectedItems,
  videoList,
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
        videoList={videoList}
      />
    </>
  );
};

export default PlaylistButton;
