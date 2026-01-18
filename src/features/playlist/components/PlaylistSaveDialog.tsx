import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { Link, LinkOff } from '@mui/icons-material';
import type { PlaylistType } from '../../../types/Playlist';

type PlaylistSaveDialogProps = {
  open: boolean;
  onClose: () => void;
  onSave: (
    type: PlaylistType,
    name: string,
    shouldCloseAfterSave?: boolean,
  ) => void;
  defaultName: string;
  defaultType?: PlaylistType;
  closeAfterSave?: boolean;
};

export const PlaylistSaveDialog = ({
  open,
  onClose,
  onSave,
  defaultName,
  defaultType = 'embedded',
  closeAfterSave = false,
}: PlaylistSaveDialogProps) => {
  const [name, setName] = useState(defaultName);
  const [saveType, setSaveType] = useState<PlaylistType>(defaultType);

  useEffect(() => {
    setName(defaultName);
    setSaveType(defaultType);
  }, [defaultName, defaultType, open]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>プレイリストを保存</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="プレイリスト名"
            value={name}
            onChange={(event) => setName(event.target.value)}
            fullWidth
            size="small"
          />
          <Box>
            <Typography variant="caption" color="text.secondary" gutterBottom>
              保存形式
            </Typography>
            <ToggleButtonGroup
              value={saveType}
              exclusive
              onChange={(_, value) => value && setSaveType(value)}
              fullWidth
              size="small"
            >
              <ToggleButton value="embedded">
                <Stack direction="row" spacing={1} alignItems="center">
                  <LinkOff fontSize="small" />
                  <Box textAlign="left">
                    <Typography variant="caption" display="block">
                      スタンドアロン
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ fontSize: '0.65rem' }}
                    >
                      独立したファイル
                    </Typography>
                  </Box>
                </Stack>
              </ToggleButton>
              <ToggleButton value="reference">
                <Stack direction="row" spacing={1} alignItems="center">
                  <Link fontSize="small" />
                  <Box textAlign="left">
                    <Typography variant="caption" display="block">
                      参照
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ fontSize: '0.65rem' }}
                    >
                      元データにリンク
                    </Typography>
                  </Box>
                </Stack>
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>
          <Typography variant="caption" color="text.secondary">
            {saveType === 'embedded'
              ? 'スタンドアロン: 動画パスと描画データを含めて保存'
              : '参照: 元のタイムラインへのリンクを維持'}
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>キャンセル</Button>
        <Button
          onClick={() => onSave(saveType, name, closeAfterSave)}
          variant="contained"
          disabled={!name.trim()}
        >
          保存
        </Button>
      </DialogActions>
    </Dialog>
  );
};
