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
  MenuItem,
  Select,
  Stack,
  Typography,
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
  filterControl?: React.ReactNode;
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
  filterControl,
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
      sx={{ '& .MuiButton-root': { whiteSpace: 'nowrap' } }}
    >
      <FormControl
        size="small"
        sx={{
          minWidth: 0,
          width: { xs: '100%', sm: 340 },
          maxWidth: '100%',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 1,
          ...compactControlSx,
        }}
      >
        <Typography
          id="dashboard-select-label"
          variant="body2"
          color="text.secondary"
          sx={{ flexShrink: 0 }}
        >
          ダッシュボード
        </Typography>
        <Select
          id="dashboard-select"
          labelId="dashboard-select-label"
          value={activeDashboardId}
          sx={{ minWidth: 0, flex: 1 }}
          title={
            dashboards.find((dashboard) => dashboard.id === activeDashboardId)
              ?.name
          }
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
        {filterControl}
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
              variant="text"
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
