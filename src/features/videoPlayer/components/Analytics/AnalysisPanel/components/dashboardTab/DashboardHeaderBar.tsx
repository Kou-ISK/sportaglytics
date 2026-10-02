import React from 'react';
import AddIcon from '@mui/icons-material/Add';
import DashboardIcon from '@mui/icons-material/Dashboard';
import EditIcon from '@mui/icons-material/Edit';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
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
import type { AnalysisDashboard } from '../../../../../../../types/settings/coreTypes';

interface DashboardHeaderBarProps {
  compactControlSx: {
    '& .MuiInputBase-input': { py: number };
    '& .MuiSelect-select': { py: number };
  };
  activeDashboardId: string;
  dashboards: AnalysisDashboard[];
  isEditing: boolean;
  isSaving: boolean;
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
  isSaving,
  onDashboardChange,
  onStartEdit,
  onAddWidget,
  onCancelEdit,
  onSave,
  onOpenManagementMenu,
}: DashboardHeaderBarProps): React.JSX.Element => {
  const isTemplate = activeDashboardId === 'template-basic';
  return (
    <Box
      display="flex"
      justifyContent="space-between"
      alignItems="center"
      flexWrap="wrap"
      gap={1}
    >
      <FormControl
        size="small"
        sx={{ minWidth: 200, maxWidth: '100%', ...compactControlSx }}
      >
        <InputLabel id="dashboard-select-label">ダッシュボード</InputLabel>
        <Select
          labelId="dashboard-select-label"
          value={activeDashboardId}
          label="ダッシュボード"
          disabled={isEditing || isSaving}
          onChange={(event) => onDashboardChange(event.target.value as string)}
        >
          {dashboards.map((dashboard) => (
            <MenuItem key={dashboard.id} value={dashboard.id}>
              {dashboard.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        flexWrap="wrap"
        useFlexGap
      >
        {isTemplate && (
          <Chip label="読み取り専用" size="small" variant="outlined" />
        )}
        {isEditing && <Chip label="編集モード" color="warning" size="small" />}
        {isEditing ? (
          <>
            <Button
              disabled={isSaving}
              size="small"
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={onAddWidget}
            >
              チャートを追加
            </Button>
            <Button
              disabled={isSaving}
              size="small"
              variant="outlined"
              onClick={onCancelEdit}
            >
              キャンセル
            </Button>
            <Button
              disabled={isSaving}
              size="small"
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={onSave}
            >
              {isSaving ? '保存中…' : '保存'}
            </Button>
          </>
        ) : (
          <>
            <Button
              disabled={isSaving}
              size="small"
              variant="outlined"
              startIcon={isTemplate ? <ContentCopyIcon /> : <EditIcon />}
              onClick={onStartEdit}
            >
              {isTemplate ? '複製して編集' : '編集'}
            </Button>
            {!isTemplate && (
              <Button
                disabled={isSaving}
                size="small"
                variant="contained"
                startIcon={<AddIcon />}
                onClick={onAddWidget}
              >
                チャートを追加
              </Button>
            )}
            <Button
              disabled={isSaving}
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
