import { useState } from 'react';
import Sort from '@mui/icons-material/Sort';
import { IconButton, Menu, MenuItem, Tooltip } from '@mui/material';
import type { TimelineRowSortSpec } from '../../../../../types/timeline/core';

interface TimelineRowSortControlProps {
  onSort: (spec: TimelineRowSortSpec) => void;
}

export const TimelineRowSortControl = ({
  onSort,
}: TimelineRowSortControlProps) => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const applySort = (spec: TimelineRowSortSpec): void => {
    onSort(spec);
    setAnchorEl(null);
  };

  return (
    <>
      <Tooltip title="行を並べ替え">
        <IconButton
          size="small"
          aria-label="行を並べ替え"
          onClick={(event) => setAnchorEl(event.currentTarget)}
        >
          <Sort fontSize="small" />
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      >
        <MenuItem onClick={() => applySort({ criterion: 'color' })}>
          色でまとめる
        </MenuItem>
        <MenuItem
          onClick={() => applySort({ criterion: 'name', direction: 'asc' })}
        >
          名前 A → Z
        </MenuItem>
        <MenuItem
          onClick={() => applySort({ criterion: 'name', direction: 'desc' })}
        >
          名前 Z → A
        </MenuItem>
        <MenuItem
          onClick={() =>
            applySort({ criterion: 'instanceCount', direction: 'desc' })
          }
        >
          インスタンス数 多 → 少
        </MenuItem>
        <MenuItem
          onClick={() =>
            applySort({ criterion: 'instanceCount', direction: 'asc' })
          }
        >
          インスタンス数 少 → 多
        </MenuItem>
      </Menu>
    </>
  );
};
