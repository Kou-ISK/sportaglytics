import React from 'react';
import {
  Button,
  Collapse,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';

interface DashboardWidgetQuickAdvancedSectionProps {
  showTemplates: boolean;
  setShowTemplates: (value: boolean) => void;
  quickAction: string;
  setQuickAction: (value: string) => void;
  availableActions: string[];
  quickLabelGroup: string;
  setQuickLabelGroup: (value: string) => void;
  availableGroups: string[];
  handleQuickPieApply: () => void;
  showAdvanced: boolean;
  setShowAdvanced: (value: boolean) => void;
  colSpan: 4 | 6 | 12;
  setColSpan: (value: 4 | 6 | 12) => void;
  limit: number | '';
  setLimit: (value: number | '') => void;
}

export const DashboardWidgetQuickAdvancedSection = ({
  showTemplates,
  setShowTemplates,
  quickAction,
  setQuickAction,
  availableActions,
  quickLabelGroup,
  setQuickLabelGroup,
  availableGroups,
  handleQuickPieApply,
  showAdvanced,
  setShowAdvanced,
  colSpan,
  setColSpan,
  limit,
  setLimit,
}: DashboardWidgetQuickAdvancedSectionProps) => {
  return (
    <>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={1.5}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              6. クイック設定
            </Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={showTemplates}
                  onChange={(event) => setShowTemplates(event.target.checked)}
                />
              }
              label={showTemplates ? '表示中' : '使わない'}
            />
          </Stack>
          <Typography variant="caption" color="text.secondary">
            よく使う円グラフをすぐ作成します（現在の入力を上書きします）。
          </Typography>
          <Collapse in={showTemplates}>
            <Stack spacing={1.5}>
              <FormControl fullWidth size="small">
                <InputLabel id="quick-action-label">アクション</InputLabel>
                <Select
                  labelId="quick-action-label"
                  value={quickAction}
                  label="アクション"
                  onChange={(event) => setQuickAction(event.target.value)}
                >
                  <MenuItem value="">指定なし</MenuItem>
                  {availableActions.map((action) => (
                    <MenuItem key={action} value={action}>
                      {action}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Stack direction="row" spacing={2} alignItems="center">
                <FormControl fullWidth size="small">
                  <InputLabel id="quick-label-group">ラベルグループ</InputLabel>
                  <Select
                    labelId="quick-label-group"
                    value={quickLabelGroup}
                    label="ラベルグループ"
                    onChange={(event) => setQuickLabelGroup(event.target.value)}
                  >
                    {availableGroups.map((group) => (
                      <MenuItem key={group} value={group}>
                        {group}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Button variant="outlined" onClick={handleQuickPieApply}>
                  適用
                </Button>
              </Stack>
            </Stack>
          </Collapse>
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={1.5}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              7. 詳細設定
            </Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={showAdvanced}
                  onChange={(event) => setShowAdvanced(event.target.checked)}
                />
              }
              label={showAdvanced ? '表示中' : '使わない'}
            />
          </Stack>
          <Typography variant="caption" color="text.secondary">
            カードのサイズや上位件数の絞り込みを設定します。
          </Typography>
          <Collapse in={showAdvanced}>
            <Stack spacing={1.5}>
              <Stack direction="row" spacing={2}>
                <FormControl fullWidth size="small">
                  <InputLabel id="col-span-label">カード幅</InputLabel>
                  <Select
                    labelId="col-span-label"
                    value={colSpan}
                    label="カード幅"
                    onChange={(event) => setColSpan(event.target.value as 4 | 6 | 12)}
                  >
                    <MenuItem value={4}>1/3</MenuItem>
                    <MenuItem value={6}>1/2</MenuItem>
                    <MenuItem value={12}>全幅</MenuItem>
                  </Select>
                </FormControl>
                <TextField
                  label="上位N件"
                  type="number"
                  size="small"
                  value={limit}
                  onChange={(event) => {
                    const next = Number(event.target.value);
                    setLimit(Number.isFinite(next) ? next : '');
                  }}
                  inputProps={{ min: 1, max: 50 }}
                />
              </Stack>
            </Stack>
          </Collapse>
        </Stack>
      </Paper>
    </>
  );
};
