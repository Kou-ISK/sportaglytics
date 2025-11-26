import React from 'react';
import {
  Box,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Typography,
} from '@mui/material';
import { MatrixFilterState } from './hooks/useMatrixFilters';

interface MatrixFiltersProps {
  filters: MatrixFilterState;
  availableTeams: string[];
  availableActions: string[];
  availableLabelValues: string[];
  availableGroups: string[];
  onTeamChange: (value: string) => void;
  onActionChange: (value: string) => void;
  onLabelGroupChange: (value: string) => void;
  onLabelValueChange: (value: string) => void;
  onClearLabelFilters: () => void;
  hasActiveFilters: boolean;
}

const ALL = 'all';

export const MatrixFilters: React.FC<MatrixFiltersProps> = ({
  filters,
  availableTeams,
  availableActions,
  availableLabelValues,
  availableGroups,
  onTeamChange,
  onActionChange,
  onLabelGroupChange,
  onLabelValueChange,
  onClearLabelFilters,
  hasActiveFilters,
}) => {
  return (
    <>
      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
        フィルタ
      </Typography>
      <Box display="grid" gridTemplateColumns="1fr 1fr 1fr 1fr" gap={2}>
        <FormControl size="small" fullWidth>
          <InputLabel>チーム</InputLabel>
          <Select
            value={filters.team}
            label="チーム"
            onChange={(e) => onTeamChange(e.target.value)}
          >
            <MenuItem value={ALL}>全て</MenuItem>
            {availableTeams.map((team) => (
              <MenuItem key={team} value={team}>
                {team}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" fullWidth>
          <InputLabel>アクション</InputLabel>
          <Select
            value={filters.action}
            label="アクション"
            onChange={(e) => onActionChange(e.target.value)}
            disabled={availableActions.length === 0}
          >
            <MenuItem value={ALL}>全て</MenuItem>
            {availableActions.map((action) => (
              <MenuItem key={action} value={action}>
                {action}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" fullWidth>
          <InputLabel>ラベルグループ</InputLabel>
          <Select
            value={filters.labelGroup}
            label="ラベルグループ"
            onChange={(e) => onLabelGroupChange(e.target.value)}
          >
            <MenuItem value={ALL}>全て</MenuItem>
            {availableGroups.map((group) => (
              <MenuItem key={group} value={group}>
                {group}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" fullWidth>
          <InputLabel>ラベル値</InputLabel>
          <Select
            value={filters.labelValue}
            label="ラベル値"
            onChange={(e) => onLabelValueChange(e.target.value)}
            disabled={
              filters.labelGroup === ALL || availableLabelValues.length === 0
            }
          >
            <MenuItem value={ALL}>全て</MenuItem>
            {availableLabelValues.map((value) => (
              <MenuItem key={value} value={value}>
                {value}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {hasActiveFilters && (
        <Box display="flex" gap={1} alignItems="center" flexWrap="wrap">
          <Typography variant="caption" color="text.secondary">
            適用中:
          </Typography>
          {filters.team !== ALL && (
            <Chip
              label={`チーム: ${filters.team}`}
              size="small"
              onDelete={() => onTeamChange(ALL)}
            />
          )}
          {filters.action !== ALL && (
            <Chip
              label={`アクション: ${filters.action}`}
              size="small"
              onDelete={() => onActionChange(ALL)}
            />
          )}
          {filters.labelGroup !== ALL && filters.labelValue !== ALL && (
            <Chip
              label={`${filters.labelGroup}: ${filters.labelValue}`}
              size="small"
              onDelete={onClearLabelFilters}
            />
          )}
        </Box>
      )}
    </>
  );
};
