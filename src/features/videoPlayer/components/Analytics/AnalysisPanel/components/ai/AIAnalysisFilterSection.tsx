import React from 'react';
import {
  Collapse,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

interface AIAnalysisFilterSectionProps {
  showFilters: boolean;
  startTime: string;
  setStartTime: (value: string) => void;
  endTime: string;
  setEndTime: (value: string) => void;
  labelGroup: string;
  setLabelGroup: (value: string) => void;
  labelName: string;
  setLabelName: (value: string) => void;
  availableGroups: string[];
  availableLabels: string[];
  effectiveTeamGroup: string;
  teamName: string;
  setTeamName: (value: string) => void;
  availableTeamLabels: string[];
}

export const AIAnalysisFilterSection = ({
  showFilters,
  startTime,
  setStartTime,
  endTime,
  setEndTime,
  labelGroup,
  setLabelGroup,
  labelName,
  setLabelName,
  availableGroups,
  availableLabels,
  effectiveTeamGroup,
  teamName,
  setTeamName,
  availableTeamLabels,
}: AIAnalysisFilterSectionProps) => {
  return (
    <Collapse in={showFilters}>
      <Stack spacing={2} mt={1}>
        <Typography variant="caption" color="text.secondary">
          時間やラベルで絞り込みたい場合だけ設定してください。
        </Typography>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <TextField
            label="開始秒（任意）"
            value={startTime}
            onChange={(event) => setStartTime(event.target.value)}
            type="number"
            inputProps={{ min: 0, step: 1 }}
            sx={{ flex: 1 }}
          />
          <TextField
            label="終了秒（任意）"
            value={endTime}
            onChange={(event) => setEndTime(event.target.value)}
            type="number"
            inputProps={{ min: 0, step: 1 }}
            sx={{ flex: 1 }}
          />
          <FormControl sx={{ flex: 1 }}>
            <InputLabel id="ai-label-group">ラベルgroup</InputLabel>
            <Select
              labelId="ai-label-group"
              label="ラベルgroup"
              value={labelGroup}
              onChange={(event) => setLabelGroup(event.target.value)}
            >
              <MenuItem value="">すべて</MenuItem>
              {availableGroups.map((group) => (
                <MenuItem key={group} value={group}>
                  {group}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl sx={{ flex: 1 }} disabled={!labelGroup}>
            <InputLabel id="ai-label-name">ラベル名</InputLabel>
            <Select
              labelId="ai-label-name"
              label="ラベル名"
              value={labelName}
              onChange={(event) => setLabelName(event.target.value)}
            >
              <MenuItem value="">すべて</MenuItem>
              {availableLabels.map((label) => (
                <MenuItem key={label} value={label}>
                  {label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>

        {effectiveTeamGroup && (
          <FormControl sx={{ maxWidth: 260 }}>
            <InputLabel id="ai-team-label">チーム</InputLabel>
            <Select
              labelId="ai-team-label"
              label="チーム"
              value={teamName}
              onChange={(event) => setTeamName(event.target.value)}
            >
              <MenuItem value="">すべて</MenuItem>
              {availableTeamLabels.map((label) => (
                <MenuItem key={label} value={label}>
                  {label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
      </Stack>
    </Collapse>
  );
};
