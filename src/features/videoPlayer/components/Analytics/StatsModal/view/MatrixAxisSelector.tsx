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
  const handleTypeChange = (event: SelectChangeEvent<MatrixAxisType>) => {
    const newType = event.target.value as MatrixAxisType;
    onChange({
      type: newType,
      value: newType === 'group' ? availableGroups[0] : undefined,
    });
  };

  const handleGroupChange = (event: SelectChangeEvent<string>) => {
    onChange({
      ...value,
      value: event.target.value,
    });
  };

  return (
    <Stack spacing={2}>
      <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
        {label}
      </Typography>

      <FormControl fullWidth size="small">
        <InputLabel>軸タイプ</InputLabel>
        <Select value={value.type} onChange={handleTypeChange} label="軸タイプ">
          <MenuItem value="group">ラベルグループ</MenuItem>
          <MenuItem value="team">チーム</MenuItem>
          <MenuItem value="action">アクション</MenuItem>
        </Select>
      </FormControl>

      {value.type === 'group' && (
        <FormControl fullWidth size="small">
          <InputLabel>グループ</InputLabel>
          <Select
            value={value.value || ''}
            onChange={handleGroupChange}
            label="グループ"
            disabled={availableGroups.length === 0}
          >
            {availableGroups.length === 0 ? (
              <MenuItem value="" disabled>
                グループが見つかりません
              </MenuItem>
            ) : (
              availableGroups.map((group) => (
                <MenuItem key={group} value={group}>
                  {group}
                </MenuItem>
              ))
            )}
          </Select>
        </FormControl>
      )}
    </Stack>
  );
};
