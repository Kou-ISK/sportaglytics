import type { ReactElement, ReactNode, RefObject } from 'react';
import { Box, Typography } from '@mui/material';

export interface AngleSyncWorkspaceViewProps {
  rootRef?: RefObject<HTMLDivElement | null>;
  angleCount: number;
  selected: number | null;
  previews: ReactNode;
}

export const AngleSyncWorkspaceView = (
  props: AngleSyncWorkspaceViewProps,
): ReactElement => {
  const count = props.selected === null ? props.angleCount : 1;
  const columns = count <= 1 ? 1 : count <= 4 ? 2 : 3;
  return (
    <Box
      ref={props.rootRef}
      aria-label="アングル同期ワークスペース"
      sx={{
        height: '100%',
        minHeight: 0,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.default',
      }}
    >
      {count ? (
        <Box
          data-video-aspect-surface
          sx={{
            flex: 1,
            minHeight: 0,
            display: 'grid',
            gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${Math.ceil(count / columns)}, minmax(0, 1fr))`,
          }}
        >
          {props.previews}
        </Box>
      ) : (
        <Typography color="text.secondary">
          同期するアングルをパッケージに追加してください。
        </Typography>
      )}
      <Typography
        variant="caption"
        noWrap
        sx={{
          px: 1,
          lineHeight: '24px',
          flexShrink: 0,
          color: 'text.secondary',
        }}
      >
        アングル同期 · 1〜8で切替（同じキーで全表示）·
        タイムラインの再生ヘッドで位置を合わせ、Sで同期点
      </Typography>
    </Box>
  );
};
