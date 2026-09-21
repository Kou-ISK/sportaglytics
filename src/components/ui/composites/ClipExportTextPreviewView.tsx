import type { ReactElement } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type { ClipExportTextPreviewState } from '../../../shared/clipExport/useClipExportTextPreview';
import { CLIP_TEXT_OVERFLOW_MESSAGE } from '../../../shared/clipExport/clipExportTextLayout';

export const ClipExportTextPreviewView = ({
  preview,
}: {
  preview: ClipExportTextPreviewState;
}): ReactElement => {
  const current = preview.clips[preview.index];
  const problems = preview.clips.filter((clip) => clip.layout.overflow);
  return (
    <Stack spacing={1} aria-label="テキスト配置のプレビュー">
      {preview.loading && (
        <Stack direction="row" spacing={1} alignItems="center" role="status">
          <CircularProgress size={16} />
          <Typography variant="body2">映像とテキストを確認中…</Typography>
        </Stack>
      )}
      {preview.error && (
        <Alert
          severity="error"
          action={<Button onClick={preview.retry}>再試行</Button>}
        >
          {preview.error}
        </Alert>
      )}
      {problems.length > 0 && (
        <Alert severity="warning">
          {CLIP_TEXT_OVERFLOW_MESSAGE}
          <Box sx={{ maxHeight: 100, overflow: 'auto' }}>
            {problems.map((clip, index) => (
              <Typography variant="body2" key={index}>
                {clip.title}
              </Typography>
            ))}
          </Box>
          <Typography variant="caption">
            書き出しをキャンセルするとノートを編集できます。
          </Typography>
        </Alert>
      )}
      {preview.clips.length > 0 && (
        <TextField
          select
          size="small"
          label="確認するクリップ"
          value={preview.index}
          onChange={(event) => preview.select(Number(event.target.value))}
        >
          {preview.clips.map((clip, index) => (
            <MenuItem key={index} value={index}>
              {clip.title}
              {clip.layout.overflow ? ' — 高さ超過' : ''}
            </MenuItem>
          ))}
        </TextField>
      )}
      {preview.image && (
        <Box
          component="img"
          src={preview.image}
          alt="書き出し映像のテキスト配置"
          sx={{
            display: 'block',
            width: '100%',
            height: 'auto',
            borderRadius: 1,
          }}
        />
      )}
      {current && !current.layout.overflow && (
        <Typography variant="caption" color="text.secondary">
          {current.width}×{current.height} / 文字{' '}
          {Math.round(current.layout.fontRatio * current.height * 10) / 10}px /
          高さ {Math.round(current.layout.boxRatio * 100)}%
        </Typography>
      )}
      <Typography variant="caption" color="text.secondary">
        クリップ先頭の映像でテキスト配置を確認します。Paintとフリーズの効果はこのプレビューには含みません。高さは最大20%、文字は1080p換算で30〜24pxです。
      </Typography>
    </Stack>
  );
};
