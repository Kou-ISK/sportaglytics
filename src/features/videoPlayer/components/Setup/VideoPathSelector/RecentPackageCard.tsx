import type { ReactElement } from 'react';
import {
  Box,
  ButtonBase,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import FolderOutlined from '@mui/icons-material/FolderOutlined';
import Close from '@mui/icons-material/Close';
import ChevronRight from '@mui/icons-material/ChevronRight';
import type { RecentPackage } from './types';
export const RecentPackageCard = ({
  package: pkg,
  onOpen,
  onRemove,
  disabled = false,
}: {
  package: RecentPackage;
  onOpen: (path: string) => void;
  onRemove: (path: string) => void;
  disabled?: boolean;
}): ReactElement => (
  <Box
    component="li"
    sx={{
      display: 'flex',
      alignItems: 'center',
      borderBottom: 1,
      borderColor: 'divider',
      minWidth: 0,
      '&:last-child': { borderBottom: 0 },
      '&:hover': { bgcolor: 'action.hover' },
      '&:focus-within': { bgcolor: 'action.selected' },
    }}
  >
    <ButtonBase
      disabled={disabled}
      onClick={() => onOpen(pkg.path)}
      aria-label={`${pkg.name}を開く`}
      sx={{
        py: 1.25,
        px: 0.5,
        gap: 1.5,
        flex: 1,
        minWidth: 0,
        justifyContent: 'flex-start',
        textAlign: 'left',
        '&.Mui-focusVisible': {
          outline: '2px solid',
          outlineColor: 'primary.main',
          outlineOffset: -2,
        },
      }}
    >
      <FolderOutlined
        sx={{
          flexShrink: 0,
          fontSize: 22,
          color: 'text.secondary',
        }}
      />
      <Stack spacing={0.4} sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          component="span"
          variant="subtitle2"
          noWrap
          title={pkg.name}
        >
          {pkg.name}
        </Typography>
        <Typography
          variant="body2"
          color="text.secondary"
          noWrap
          title={`${pkg.team1Name} / ${pkg.team2Name}`}
        >
          {pkg.team1Name} / {pkg.team2Name} · {pkg.videoCount}映像
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} columnGap={2}>
          <Typography
            variant="caption"
            color="text.secondary"
            noWrap
            title={pkg.path}
            sx={{ flex: 1, minWidth: 0 }}
          >
            {pkg.path}
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}
          >
            最終利用 {new Date(pkg.lastOpened).toLocaleDateString('ja-JP')}
          </Typography>
        </Stack>
      </Stack>
      <ChevronRight
        sx={{ fontSize: 18, color: 'text.secondary', flexShrink: 0 }}
      />
    </ButtonBase>
    <Tooltip title="履歴から除く（ファイルは削除しません）">
      <span>
        <IconButton
          disabled={disabled}
          aria-label={`${pkg.name}を最近開いたパッケージから削除`}
          onClick={() => onRemove(pkg.path)}
          size="small"
          sx={{ mr: 1 }}
        >
          <Close fontSize="small" />
        </IconButton>
      </span>
    </Tooltip>
  </Box>
);
