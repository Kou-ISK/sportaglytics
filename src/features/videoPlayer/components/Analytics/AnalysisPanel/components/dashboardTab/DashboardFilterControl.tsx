import { useState } from 'react';
import type { ReactNode, JSX } from 'react';
import { Button, Popover } from '@mui/material';
import FilterListIcon from '@mui/icons-material/FilterList';

interface DashboardFilterControlProps {
  filterCount: number;
  renderEditor: (onClose: () => void) => ReactNode;
}

export const DashboardFilterControl = ({
  filterCount,
  renderEditor,
}: DashboardFilterControlProps): JSX.Element => {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const onClose = (): void => setAnchor(null);
  return (
    <>
      <Button
        size="small"
        variant="text"
        startIcon={<FilterListIcon />}
        aria-label={filterCount > 0 ? 'フィルタを編集' : 'フィルタを追加'}
        aria-haspopup="dialog"
        aria-expanded={Boolean(anchor)}
        aria-controls={anchor ? 'dashboard-filter-popover' : undefined}
        onClick={(event) => setAnchor(event.currentTarget)}
      >
        フィルター{filterCount > 0 ? ` (${filterCount})` : ''}
      </Button>
      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={onClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{
          paper: {
            id: 'dashboard-filter-popover',
            role: 'dialog',
            'aria-label': '全体フィルター設定',
            sx: { p: 2, width: 560, maxWidth: 'calc(100vw - 32px)' },
          },
        }}
      >
        {renderEditor(onClose)}
      </Popover>
    </>
  );
};
