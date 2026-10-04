import type { ReactElement } from 'react';
import {
  Box,
  Button,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import Search from '@mui/icons-material/Search';
import { RecentPackageCard } from '../RecentPackageCard';
import type { RecentPackage } from '../types';
export const RecentPackagesSection = ({
  packages,
  onOpen,
  onRemove,
  searchQuery = '',
  onSearchChange,
  disabled = false,
}: {
  packages: RecentPackage[];
  onOpen: (path: string) => void;
  onRemove: (path: string) => void;
  searchQuery?: string;
  onSearchChange?: (value: string) => void;
  disabled?: boolean;
}): ReactElement => {
  const query = searchQuery.trim().toLocaleLowerCase();
  const filtered = packages.filter((pkg) =>
    [pkg.name, pkg.path, pkg.team1Name, pkg.team2Name].some((value) =>
      value.toLocaleLowerCase().includes(query),
    ),
  );
  return (
    <Stack spacing={1.5} sx={{ minWidth: 0 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography component="h2" variant="subtitle2">
          最近開いたパッケージ
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {packages.length}件
        </Typography>
      </Stack>
      <TextField
        type="search"
        size="small"
        label="履歴を検索"
        placeholder="名前・チーム・保存場所"
        value={searchQuery}
        onChange={(event) => onSearchChange?.(event.target.value)}
        fullWidth
        disabled={!packages.length || disabled}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <Search fontSize="small" />
              </InputAdornment>
            ),
          },
        }}
      />
      {filtered.length ? (
        <Box
          component="ul"
          aria-label="最近開いたパッケージ一覧"
          sx={{
            p: 0,
            m: 0,
            listStyle: 'none',
            borderTop: 1,
            borderColor: 'divider',
          }}
        >
          {filtered.map((pkg) => (
            <RecentPackageCard
              key={pkg.path}
              package={pkg}
              onOpen={onOpen}
              onRemove={onRemove}
              disabled={disabled}
            />
          ))}
        </Box>
      ) : (
        <Stack
          alignItems="flex-start"
          spacing={1}
          sx={{
            py: 3,
            borderTop: 1,
            borderColor: 'divider',
          }}
        >
          <Typography component="p" variant="subtitle2">
            {packages.length
              ? '一致するパッケージはありません'
              : '最近開いたパッケージはありません'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {packages.length
              ? '名前・チーム・保存場所を変えて検索してください。'
              : 'パッケージを開くと、次回からここで分析を再開できます。'}
          </Typography>
          {query && (
            <Button disabled={disabled} onClick={() => onSearchChange?.('')}>
              検索をクリア
            </Button>
          )}
        </Stack>
      )}
    </Stack>
  );
};
