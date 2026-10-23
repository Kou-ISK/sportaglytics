import type { ReactElement, ReactNode } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';
import { PlaybackCacheView } from './PlaybackCacheView';
import type { PlaybackCacheViewProps } from './PlaybackCacheView';
export interface PlaybackCachePanelViewProps {
  children: ReactNode;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  error: string | null;
  switching: boolean;
  cache: PlaybackCacheViewProps | null;
}
export const PlaybackCachePanelView = (
  props: PlaybackCachePanelViewProps,
): ReactElement => (
  <Box
    sx={{
      gridColumn: '1',
      gridRow: '1',
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0,
      minWidth: 0,
    }}
  >
    <Box>
      <Button size="small" onClick={props.onOpen}>
        再生用コピー
      </Button>
    </Box>
    <Box sx={{ flex: 1, minHeight: 0, minWidth: 0 }}>{props.children}</Box>
    <Dialog open={props.open} onClose={props.onClose} maxWidth="sm" fullWidth>
      <DialogTitle>再生用コピー</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <Typography variant="body2">
            検証用の初期対応です。120秒以内・512MB以内の単一MP4を対象に、全体のコピーを作成します。長尺素材はまだ対象外です。
          </Typography>
          <Typography variant="body2">
            キャッシュ合計8GB、コピー1本1GBまで。空き容量2GBを残します。生成後に映像と全音声の時刻・ハードウェア再生を確認するため、確認中は追加の再生時間がかかります。
          </Typography>
          <Typography variant="body2">
            保存済みコピーは再生成せず、原本との対応と再生環境を確認してから使えます。確認には映像全体を読む時間がかかり、キャンセルできます。
          </Typography>
          {props.error && <Alert severity="error">{props.error}</Alert>}
          {props.switching && (
            <Typography role="status">
              再生位置と音声状態を復元しています…
            </Typography>
          )}
          {props.cache ? (
            <PlaybackCacheView {...props.cache} />
          ) : (
            <Alert severity="info">
              この素材・再生画面は対応していません。原本を使用します。
            </Alert>
          )}
          <Button onClick={props.onClose}>閉じる</Button>
        </Stack>
      </DialogContent>
    </Dialog>
  </Box>
);
