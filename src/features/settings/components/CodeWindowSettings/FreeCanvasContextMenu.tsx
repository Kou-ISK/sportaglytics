import React from 'react';
import { ListSubheader, Menu, MenuItem } from '@mui/material';

type ContextMenuPosition = {
  mouseX: number;
  mouseY: number;
  position: { x: number; y: number };
};

type LabelGroup = { groupName: string; options: string[] };

type FreeCanvasContextMenuProps = {
  contextMenu: ContextMenuPosition | null;
  availableActions: string[];
  availableLabelGroups: LabelGroup[];
  onClose: () => void;
  onAddAction: (actionName: string) => void;
  onAddLabel: (groupName: string, option: string) => void;
  onOpenCustomAction: (position: { x: number; y: number }) => void;
  onOpenCustomLabel: (position: { x: number; y: number }) => void;
};

export const FreeCanvasContextMenu = ({
  contextMenu,
  onClose,
  onOpenCustomAction,
  onOpenCustomLabel,
}: FreeCanvasContextMenuProps) => {
  return (
    <Menu
      open={contextMenu !== null}
      onClose={onClose}
      anchorReference="anchorPosition"
      anchorPosition={
        contextMenu !== null
          ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
          : undefined
      }
      PaperProps={{
        sx: {
          width: 188,
          maxWidth: 'calc(100vw - 24px)',
        },
      }}
    >
      <ListSubheader
        disableSticky
        sx={{ lineHeight: '26px', fontSize: '0.68rem' }}
      >
        ボタンを追加
      </ListSubheader>
      <MenuItem
        onClick={() => {
          if (contextMenu) {
            onOpenCustomAction(contextMenu.position);
          }
          onClose();
        }}
        sx={{ minHeight: 30, fontSize: '0.82rem' }}
      >
        アクション...
      </MenuItem>
      <MenuItem
        onClick={() => {
          if (contextMenu) {
            onOpenCustomLabel(contextMenu.position);
          }
          onClose();
        }}
        sx={{ minHeight: 30, fontSize: '0.82rem' }}
      >
        ラベル...
      </MenuItem>
    </Menu>
  );
};
