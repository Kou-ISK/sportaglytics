import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Typography,
} from '@mui/material';
import {
  createDefaultMatrixFilters,
  MATRIX_FILTER_ALL,
  type MatrixFilterState,
} from '../controllers/matrixFilterUtils';

interface MatrixFiltersProps {
  filters: MatrixFilterState;
  availableTeams: string[];
  availableActions: string[];
  availableLabelValues: string[];
  availableActionsByTeam: Record<string, string[]>;
  availableLabelValuesByGroup: Record<string, string[]>;
  availableGroups: string[];
  onFiltersApply: (filters: MatrixFilterState) => void;
  hasActiveFilters: boolean;
  onApply?: () => void;
  onClose?: () => void;
}

const hasDraftFilters = (filters: MatrixFilterState): boolean => {
  return Object.values(filters).some(
    (value) => value !== '' && value !== MATRIX_FILTER_ALL,
  );
};

export const MatrixFilters: React.FC<MatrixFiltersProps> = ({
  filters,
  availableTeams,
  availableActions,
  availableLabelValues,
  availableActionsByTeam,
  availableLabelValuesByGroup,
  availableGroups,
  onFiltersApply,
  hasActiveFilters,
  onApply,
  onClose,
}) => {
  const [draftFilters, setDraftFilters] =
    useState<MatrixFilterState>(filters);
  const hasDraftActiveFilters = useMemo(
    () => hasDraftFilters(draftFilters),
    [draftFilters],
  );
  const draftAvailableActions =
    draftFilters.team === MATRIX_FILTER_ALL
      ? availableActions
      : (availableActionsByTeam[draftFilters.team] ?? []);
  const draftAvailableLabelValues =
    draftFilters.labelGroup === MATRIX_FILTER_ALL
      ? []
      : (availableLabelValuesByGroup[draftFilters.labelGroup] ??
        availableLabelValues);
  const compactControlSx = {
    '& .MuiInputBase-input': { py: 0.75 },
    '& .MuiSelect-select': { py: 0.75 },
  };

  useEffect(() => {
    setDraftFilters(filters);
  }, [filters]);

  const handleClose = (): void => {
    setDraftFilters(filters);
    onClose?.();
  };

  const handleApply = (): void => {
    onFiltersApply(draftFilters);
    onApply?.();
  };

  return (
    <>
      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
        フィルタ
      </Typography>
      <Box
        display="grid"
        gridTemplateColumns={{ xs: '1fr', sm: '1fr 1fr', lg: '1fr 1fr 1fr 1fr' }}
        gap={1.5}
      >
        <FormControl size="small" fullWidth sx={compactControlSx}>
          <InputLabel>チーム</InputLabel>
          <Select
            value={draftFilters.team}
            label="チーム"
            onChange={(e) =>
              setDraftFilters((prev) => ({
                ...prev,
                team: e.target.value,
                action: MATRIX_FILTER_ALL,
              }))
            }
          >
            <MenuItem value={MATRIX_FILTER_ALL}>全て</MenuItem>
            {availableTeams.map((team) => (
              <MenuItem key={team} value={team}>
                {team}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" fullWidth sx={compactControlSx}>
          <InputLabel>アクション</InputLabel>
          <Select
            value={draftFilters.action}
            label="アクション"
            onChange={(e) =>
              setDraftFilters((prev) => ({
                ...prev,
                action: e.target.value,
              }))
            }
            disabled={draftAvailableActions.length === 0}
          >
            <MenuItem value={MATRIX_FILTER_ALL}>全て</MenuItem>
            {draftAvailableActions.map((action) => (
              <MenuItem key={action} value={action}>
                {action}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" fullWidth sx={compactControlSx}>
          <InputLabel>ラベルグループ</InputLabel>
          <Select
            value={draftFilters.labelGroup}
            label="ラベルグループ"
            onChange={(e) =>
              setDraftFilters((prev) => ({
                ...prev,
                labelGroup: e.target.value,
                labelValue: MATRIX_FILTER_ALL,
              }))
            }
          >
            <MenuItem value={MATRIX_FILTER_ALL}>全て</MenuItem>
            {availableGroups.map((group) => (
              <MenuItem key={group} value={group}>
                {group}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" fullWidth sx={compactControlSx}>
          <InputLabel>ラベル値</InputLabel>
          <Select
            value={draftFilters.labelValue}
            label="ラベル値"
            onChange={(e) =>
              setDraftFilters((prev) => ({
                ...prev,
                labelValue: e.target.value,
              }))
            }
            disabled={
              draftFilters.labelGroup === MATRIX_FILTER_ALL ||
              draftAvailableLabelValues.length === 0
            }
          >
            <MenuItem value={MATRIX_FILTER_ALL}>全て</MenuItem>
            {draftAvailableLabelValues.map((value) => (
              <MenuItem key={value} value={value}>
                {value}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {(hasActiveFilters || hasDraftActiveFilters) && (
        <Box display="flex" gap={1} alignItems="center" flexWrap="wrap">
          <Typography variant="caption" color="text.secondary">
            編集中:
          </Typography>
          {draftFilters.team !== MATRIX_FILTER_ALL && (
            <Chip
              label={`チーム: ${draftFilters.team}`}
              size="small"
              onDelete={() =>
                setDraftFilters((prev) => ({
                  ...prev,
                  team: MATRIX_FILTER_ALL,
                }))
              }
            />
          )}
          {draftFilters.action !== MATRIX_FILTER_ALL && (
            <Chip
              label={`アクション: ${draftFilters.action}`}
              size="small"
              onDelete={() =>
                setDraftFilters((prev) => ({
                  ...prev,
                  action: MATRIX_FILTER_ALL,
                }))
              }
            />
          )}
          {draftFilters.labelGroup !== MATRIX_FILTER_ALL && (
            <Chip
              label={
                draftFilters.labelValue !== MATRIX_FILTER_ALL
                  ? `${draftFilters.labelGroup}: ${draftFilters.labelValue}`
                  : `ラベルグループ: ${draftFilters.labelGroup}`
              }
              size="small"
              onDelete={() =>
                setDraftFilters((prev) => ({
                  ...prev,
                  labelGroup: MATRIX_FILTER_ALL,
                  labelValue: MATRIX_FILTER_ALL,
                }))
              }
            />
          )}
        </Box>
      )}

      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        gap={1}
        mt={0.5}
        flexWrap="wrap"
      >
        <Button
          size="small"
          variant="outlined"
          disabled={!hasDraftActiveFilters}
          onClick={() => setDraftFilters(createDefaultMatrixFilters())}
        >
          すべてクリア
        </Button>
        <Box display="flex" justifyContent="flex-end" gap={1}>
          <Button size="small" variant="outlined" onClick={handleClose}>
            閉じる
          </Button>
          <Button size="small" variant="contained" onClick={handleApply}>
            適用
          </Button>
        </Box>
      </Box>
    </>
  );
};
