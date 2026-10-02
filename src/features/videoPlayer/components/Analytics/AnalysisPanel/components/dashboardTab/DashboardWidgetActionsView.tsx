import type { ReactElement } from 'react';
import { IconButton, Stack, Tooltip } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';

interface DashboardWidgetActionsViewProps {
  title: string;
  onEdit: () => void;
  onDuplicate: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
}

export const DashboardWidgetActionsView = ({
  title,
  onEdit,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  onDelete,
}: DashboardWidgetActionsViewProps): ReactElement => (
  <Stack direction="row" spacing={0.5}>
    {[
      { label: '編集', icon: <EditIcon fontSize="small" />, onClick: onEdit },
      {
        label: '複製',
        icon: <ContentCopyIcon fontSize="small" />,
        onClick: onDuplicate,
      },
      {
        label: '上へ移動',
        icon: <ArrowUpwardIcon fontSize="small" />,
        onClick: onMoveUp,
      },
      {
        label: '下へ移動',
        icon: <ArrowDownwardIcon fontSize="small" />,
        onClick: onMoveDown,
      },
      {
        label: '削除',
        icon: <DeleteOutlineIcon fontSize="small" />,
        onClick: onDelete,
      },
    ].map(({ label, icon, onClick }) => (
      <Tooltip key={label} title={label}>
        <IconButton
          size="small"
          aria-label={`${title}を${label}`}
          onClick={onClick}
        >
          {icon}
        </IconButton>
      </Tooltip>
    ))}
  </Stack>
);
