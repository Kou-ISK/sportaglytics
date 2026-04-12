import React from 'react';
import {
  Divider,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import MoveToInboxIcon from '@mui/icons-material/MoveToInbox';
import OutboxIcon from '@mui/icons-material/Outbox';
import type { AnalysisDashboard } from '../../../../../../../types/settings/coreTypes';

interface DashboardManagementMenuProps {
  anchorEl: HTMLElement | null;
  onClose: () => void;
  activeDashboard?: AnalysisDashboard;
  onCreate: () => void;
  onDuplicate: () => Promise<void>;
  onRequestDelete: () => void;
  onImport: () => Promise<void>;
  onExport: () => Promise<void>;
}

export const DashboardManagementMenu = ({
  anchorEl,
  onClose,
  activeDashboard,
  onCreate,
  onDuplicate,
  onRequestDelete,
  onImport,
  onExport,
}: DashboardManagementMenuProps) => {
  return (
    <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={onClose}>
      <MenuItem
        onClick={() => {
          onClose();
          onCreate();
        }}
      >
        <ListItemIcon>
          <AddIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>新規作成</ListItemText>
      </MenuItem>
      <MenuItem
        onClick={async () => {
          onClose();
          await onDuplicate();
        }}
      >
        <ListItemIcon>
          <ContentCopyIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>複製</ListItemText>
      </MenuItem>
      <MenuItem
        disabled={
          activeDashboard?.id === 'default' ||
          activeDashboard?.id === 'template-basic'
        }
        onClick={() => {
          onClose();
          onRequestDelete();
        }}
      >
        <ListItemIcon>
          <DeleteOutlineIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>削除</ListItemText>
      </MenuItem>
      <Divider />
      <MenuItem
        onClick={async () => {
          onClose();
          await onImport();
        }}
      >
        <ListItemIcon>
          <MoveToInboxIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>インポート</ListItemText>
      </MenuItem>
      <MenuItem
        onClick={async () => {
          onClose();
          await onExport();
        }}
      >
        <ListItemIcon>
          <OutboxIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>エクスポート</ListItemText>
      </MenuItem>
    </Menu>
  );
};
