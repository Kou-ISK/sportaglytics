import React from 'react';
import {
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import type { DashboardSeriesFilter } from '../../../../../../../types/Settings';

interface DashboardFilterEditorProps {
  compactControlSx: {
    '& .MuiInputBase-input': { py: number };
    '& .MuiSelect-select': { py: number };
  };
  dashboardFilters: DashboardSeriesFilter;
  availableTeams: string[];
  availableActions: string[];
  availableGroups: string[];
  availableLabelValues: Record<string, string[]>;
  updateDashboardFilters: (patch: Partial<DashboardSeriesFilter>) => void;
  onResetFilters: () => void;
  onClose: () => void;
}

export const DashboardFilterEditor = ({
  compactControlSx,
  dashboardFilters,
  availableTeams,
  availableActions,
  availableGroups,
  availableLabelValues,
  updateDashboardFilters,
  onResetFilters,
  onClose,
}: DashboardFilterEditorProps) => {
  return (
    <Stack spacing={1.5}>
      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
        全体フィルター設定
      </Typography>
      <Typography variant="body2" color="text.secondary">
        ダッシュボード全体のスコープを絞り込めます。
      </Typography>
      <Box display="grid" gridTemplateColumns="1fr 1fr" gap={1.5}>
        <FormControl size="small" fullWidth sx={compactControlSx}>
          <InputLabel id="dashboard-filter-team">チーム</InputLabel>
          <Select
            labelId="dashboard-filter-team"
            value={dashboardFilters.team ?? ''}
            label="チーム"
            onChange={(event) =>
              updateDashboardFilters({
                team: event.target.value || undefined,
              })
            }
          >
            <MenuItem value="">指定なし</MenuItem>
            {availableTeams.map((team) => (
              <MenuItem key={team} value={team}>
                {team}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" fullWidth sx={compactControlSx}>
          <InputLabel id="dashboard-filter-action">アクション</InputLabel>
          <Select
            labelId="dashboard-filter-action"
            value={dashboardFilters.action ?? ''}
            label="アクション"
            onChange={(event) =>
              updateDashboardFilters({
                action: event.target.value || undefined,
              })
            }
          >
            <MenuItem value="">指定なし</MenuItem>
            {availableActions.map((action) => (
              <MenuItem key={action} value={action}>
                {action}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" fullWidth sx={compactControlSx}>
          <InputLabel id="dashboard-filter-group">ラベルグループ</InputLabel>
          <Select
            labelId="dashboard-filter-group"
            value={dashboardFilters.labelGroup ?? ''}
            label="ラベルグループ"
            onChange={(event) =>
              updateDashboardFilters({
                labelGroup: event.target.value || undefined,
                labelValue: undefined,
              })
            }
          >
            <MenuItem value="">指定なし</MenuItem>
            {availableGroups.map((group) => (
              <MenuItem key={group} value={group}>
                {group}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" fullWidth sx={compactControlSx}>
          <InputLabel id="dashboard-filter-value">ラベル値</InputLabel>
          <Select
            labelId="dashboard-filter-value"
            value={dashboardFilters.labelValue ?? ''}
            label="ラベル値"
            onChange={(event) =>
              updateDashboardFilters({
                labelValue: event.target.value || undefined,
              })
            }
            disabled={!dashboardFilters.labelGroup}
          >
            <MenuItem value="">指定なし</MenuItem>
            {(
              (dashboardFilters.labelGroup &&
                availableLabelValues[dashboardFilters.labelGroup]) ||
              []
            ).map((value) => (
              <MenuItem key={value} value={value}>
                {value}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      <Box display="flex" justifyContent="flex-end" gap={1}>
        <Button size="small" variant="outlined" onClick={onResetFilters}>
          すべてクリア
        </Button>
        <Button size="small" variant="contained" onClick={onClose}>
          閉じる
        </Button>
      </Box>
    </Stack>
  );
};
