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
}

export const MatrixAxisSelector: React.FC<MatrixAxisSelectorProps> = ({
  label,
  value,
  onChange,
  availableGroups,
}) => {
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

  const handleGroupChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
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
            native
            labelId={`${label}-group-label`}
            id={`${label}-group-select`}
            value={
              value.value ||
              (availableGroups.length > 0 ? availableGroups[0] : '')
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onChange={handleGroupChange as any}
            label="グループ"
            disabled={availableGroups.length === 0}
          >
            <option value="all_labels">全てのラベル</option>
            {availableGroups.map((group) => (
              <option key={group} value={group}>
                {group}
              </option>
            ))}
          </Select>
        </FormControl>
      )}
    </Stack>
  );
};
