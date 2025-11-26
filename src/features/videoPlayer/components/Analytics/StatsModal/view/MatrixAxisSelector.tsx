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

export const MatrixAxisSelector: React.FC<MatrixAxisSelectorProps> = (
  props,
) => {
  const {
    label,
    value,
    onChange,
    availableGroups,
  } = props;

  const handleTypeChange = (event: SelectChangeEvent<MatrixAxisType>) => {
    const newType = event.target.value as MatrixAxisType;
    onChange({
      ...value,
      type: newType,
      value: newType === 'group' ? value.value : '',
    });
  };

  const handleValueChange = (event: SelectChangeEvent<string>) => {
    const newValue = event.target.value;
    onChange({ ...value, value: newValue });
  };

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
    </Stack>
  );
};
