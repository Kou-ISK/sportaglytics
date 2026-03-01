import React from 'react';
import AddIcon from '@mui/icons-material/Add';
import DashboardIcon from '@mui/icons-material/Dashboard';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import {
  Box,
  Button,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
} from '@mui/material';
import type { AnalysisDashboard } from '../../../../../../../types/Settings';

interface DashboardHeaderBarProps {
  compactControlSx: {
    '& .MuiInputBase-input': { py: number };
    '& .MuiSelect-select': { py: number };
  };
  activeDashboardId: string;
  dashboards: AnalysisDashboard[];
  isEditing: boolean;
  onDashboardChange: (nextId: string) => void;
  onStartEdit: () => void;
  onAddWidget: () => void;
  onCancelEdit: () => void;
  onSave: () => void;
  onOpenManagementMenu: (anchor: HTMLElement) => void;
}

export const DashboardHeaderBar = ({
  compactControlSx,
  activeDashboardId,
  dashboards,
  isEditing,
  onDashboardChange,
  onStartEdit,
  onAddWidget,
  onCancelEdit,
  onSave,
  onOpenManagementMenu,
}: DashboardHeaderBarProps) => {
  return (
    <Box display="flex" justifyContent="space-between" alignItems="center">
      <FormControl size="small" sx={{ minWidth: 220, ...compactControlSx }}>
        <InputLabel id="dashboard-select-label">ダッシュボード</InputLabel>
        <Select
          labelId="dashboard-select-label"
          value={activeDashboardId}
          label="ダッシュボード"
          disabled={isEditing}
          onChange={(event) => onDashboardChange(event.target.value as string)}
        >
          {dashboards.map((dashboard) => (
            <MenuItem key={dashboard.id} value={dashboard.id}>
              {dashboard.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <Stack direction="row" spacing={1} alignItems="center">
        {isEditing && <Chip label="編集モード" color="warning" size="small" />}
        {isEditing ? (
          <>
            <Button
              size="small"
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={onAddWidget}
            >
              チャートを追加
            </Button>
            <Button size="small" variant="outlined" onClick={onCancelEdit}>
              キャンセル
            </Button>
            <Button
              size="small"
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={onSave}
            >
              保存
            </Button>
          </>
        ) : (
          <>
            <Button
              size="small"
              variant="outlined"
              startIcon={<EditIcon />}
              onClick={onStartEdit}
            >
              編集
            </Button>
            <Button
              size="small"
              variant="contained"
              startIcon={<AddIcon />}
              onClick={onAddWidget}
            >
              チャートを追加
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={<DashboardIcon />}
              onClick={(event) => onOpenManagementMenu(event.currentTarget)}
            >
              管理
            </Button>
          </>
        )}
      </Stack>
    </Box>
  );
};
