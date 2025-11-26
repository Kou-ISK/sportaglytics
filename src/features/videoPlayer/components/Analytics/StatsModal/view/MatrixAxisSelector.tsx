import React from 'react';
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Typography,
  SelectChangeEvent,
} from '@mui/material';
import type {
  MatrixAxisConfig,
  MatrixAxisType,
} from '../../../../../../types/MatrixConfig';

// --- ここから本体 ---
interface MatrixAxisSelectorProps {
  label: string;
  value: MatrixAxisConfig;
  onChange: (config: MatrixAxisConfig) => void;
  availableGroups: string[];
  availableTeams?: string[];
  availableActions?: string[];
}

export const MatrixAxisSelector: React.FC<MatrixAxisSelectorProps> = (
  props,
) => {
  const {
    label,
    value,
    onChange,
    availableGroups,
    availableTeams = [],
    availableActions = [],
  } = props;
  const getDisplayValue = () => {
    if (value.type === 'group') {
      if (!value.value) return '';
      if (value.value === 'all_labels') return '全てのラベル';
      return value.value;
    }
    if (value.type === 'team') return 'チーム';
    if (value.type === 'action') return 'アクション';
    return '';
  };

  const handleTypeChange = (event: SelectChangeEvent<MatrixAxisType>) => {
    const newType = event.target.value as MatrixAxisType;
    onChange({ ...value, type: newType });
  };

  const handleValueChange = (event: SelectChangeEvent<string>) => {
    const newValue = event.target.value;
    onChange({ ...value, value: newValue });
  };

  const displayValue = getDisplayValue();

  console.log(`${label} DEBUG:`, {
    'value.value': value.value,
    'value.type': value.type,
    displayValue,
    availableGroups,
    'displayValue || ""': displayValue || '',
  });

  return (
    <Stack spacing={2}>
      <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
        {label}
      </Typography>

      <FormControl fullWidth size="small">
        <InputLabel id={`${label}-type-label`}>軸タイプ</InputLabel>
        <Select
          labelId={`${label}-type-label`}
          id={`${label}-type-select`}
          value={value.type}
          onChange={handleTypeChange}
          label="軸タイプ"
        >
          <MenuItem value="group">ラベルグループ</MenuItem>
          <MenuItem value="team">チーム</MenuItem>
          <MenuItem value="action">アクション</MenuItem>
        </Select>
      </FormControl>

      {value.type === 'group' && (
        <FormControl fullWidth size="small">
          <InputLabel id={`${label}-group-label`}>グループ</InputLabel>
          <Select
            labelId={`${label}-group-label`}
            id={`${label}-group-select`}
            value={
              value.value ||
              (availableGroups.length > 0 ? availableGroups[0] : '')
            }
            onChange={handleValueChange}
            label="グループ"
            disabled={availableGroups.length === 0}
          >
            <MenuItem value="all_labels">全てのラベル</MenuItem>
            {availableGroups.map((group) => (
              <MenuItem key={group} value={group}>
                {group}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      )}

      {value.type === 'team' && (
        <FormControl fullWidth size="small">
          <InputLabel id={`${label}-team-label`}>チーム</InputLabel>
          <Select
            labelId={`${label}-team-label`}
            id={`${label}-team-select`}
            value={
              value.value ||
              (availableTeams.length > 0 ? availableTeams[0] : '')
            }
            onChange={handleValueChange}
            label="チーム"
            disabled={availableTeams.length === 0}
          >
            {availableTeams.map((team) => (
              <MenuItem key={team} value={team}>
                {team}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      )}

      {value.type === 'action' && (
        <FormControl fullWidth size="small">
          <InputLabel id={`${label}-action-label`}>アクション</InputLabel>
          <Select
            labelId={`${label}-action-label`}
            id={`${label}-action-select`}
            value={
              value.value ||
              (availableActions.length > 0 ? availableActions[0] : '')
            }
            onChange={handleValueChange}
            label="アクション"
            disabled={availableActions.length === 0}
          >
            {availableActions.map((action) => (
              <MenuItem key={action} value={action}>
                {action}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      )}
    </Stack>
  );
};
