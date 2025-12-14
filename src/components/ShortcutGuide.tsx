import React, { useEffect, useState } from 'react';
import {
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Typography,
  Divider,
  Chip,
  Stack,
} from '@mui/material';
import KeyboardIcon from '@mui/icons-material/Keyboard';
import CloseIcon from '@mui/icons-material/Close';

interface ShortcutItem {
  category: string;
  items: {
    key: string;
    action: string;
    description?: string;
  }[];
}

const shortcuts: ShortcutItem[] = [
  {
    category: '再生制御',
    items: [
      { key: 'Space', action: '再生/停止' },
      { key: '←', action: '5秒戻し' },
      { key: '→', action: '0.5倍速' },
      { key: 'Shift + →', action: '2倍速' },
      { key: 'Command + →', action: '4倍速' },
      { key: 'Option + →', action: '6倍速' },
      { key: 'Shift + ←', action: '10秒戻し' },
    ],
  },
  {
    category: '音声同期',
    items: [
      { key: 'Command + Shift + S', action: '音声再同期' },
      { key: 'Command + Shift + R', action: '同期リセット' },
      { key: 'Command + Shift + O', action: '手動オフセット調整' },
    ],
  },
  {
    category: '統計・分析',
    items: [
      { key: 'Command + Shift + A', action: '統計モーダルをトグル' },
      { key: 'Command + Option + 1', action: 'ポゼッションを表示' },
      { key: 'Command + Option + 2', action: 'アクション結果を表示' },
      { key: 'Command + Option + 3', action: 'アクション種別を表示' },
      { key: 'Command + Option + 4', action: 'モメンタムを表示' },
      { key: 'Command + Option + 5', action: 'クロス集計を表示' },
      { key: 'Command + /', action: 'ショートカット一覧を表示' },
    ],
  },
  {
    category: 'タイムライン編集',
    items: [
      { key: '↑/↓', action: 'タイムラインアイテムを移動' },
      { key: 'Tab / Option + ↓', action: '同じアクションの次へジャンプ' },
      {
        key: 'Shift + Tab / Option + ↑',
        action: '同じアクションの前へジャンプ',
      },
      { key: 'Enter', action: '選択したアイテムを編集' },
      { key: 'Delete/Backspace', action: '選択したアイテムを削除' },
      { key: 'Command + Z', action: '元に戻す' },
      { key: 'Command + Shift + Z', action: 'やり直し' },
    ],
  },
];

interface ShortcutGuideProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const ShortcutGuide: React.FC<ShortcutGuideProps> = ({
  open: controlledOpen,
  onOpenChange,
}) => {
  const [internalOpen, setInternalOpen] = useState(false);

  // 制御モード（外部からopenを渡された場合）と非制御モードの両方に対応
  const open = controlledOpen ?? internalOpen;
  const setOpen = (newOpen: boolean) => {
    if (onOpenChange) {
      onOpenChange(newOpen);
    } else {
      setInternalOpen(newOpen);
    }
  };

  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);

  useEffect(() => {
    if (!window.electronAPI?.on) {
      return;
    }

    const handler = () => setOpen(true);

    window.electronAPI.on('menu-show-shortcuts', handler);

    return () => {
      try {
        window.electronAPI?.off?.('menu-show-shortcuts', handler);
      } catch (error) {
        console.debug('shortcut menu cleanup error', error);
      }
    };
  }, []);

  return (
    <>
      <IconButton
        onClick={handleOpen}
        size="small"
        sx={{
          border: '1px solid',
          borderColor: 'divider',
          '&:hover': {
            bgcolor: 'action.hover',
          },
        }}
        title="キーボードショートカット"
      >
        <KeyboardIcon fontSize="small" />
      </IconButton>

      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
          >
            <Stack direction="row" spacing={1} alignItems="center">
              <KeyboardIcon />
              <Typography variant="h6">キーボードショートカット</Typography>
            </Stack>
            <IconButton onClick={handleClose} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent>
          <Stack spacing={3}>
            {shortcuts.map((section) => (
              <Box key={section.category}>
                <Typography
                  variant="subtitle2"
                  color="primary"
                  gutterBottom
                  sx={{ fontWeight: 600 }}
                >
                  {section.category}
                </Typography>
                <Divider sx={{ mb: 1.5 }} />

                <Stack spacing={1}>
                  {section.items.map((item) => (
                    <Box
                      key={item.key}
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        py: 0.5,
                      }}
                    >
                      <Typography variant="body2">{item.action}</Typography>
                      <Chip
                        label={item.key}
                        size="small"
                        variant="outlined"
                        sx={{
                          fontFamily: 'monospace',
                          fontSize: '0.75rem',
                          minWidth: 80,
                        }}
                      />
                    </Box>
                  ))}
                </Stack>
              </Box>
            ))}

            <Box sx={{ mt: 2, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
              <Typography variant="caption" color="text.secondary">
                💡 ヒント:
                映像視聴中はキーボードショートカットを使うと効率的に操作できます
              </Typography>
            </Box>
          </Stack>
        </DialogContent>
      </Dialog>
    </>
  );
};
