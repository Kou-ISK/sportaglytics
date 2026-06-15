import React from 'react';
import { Box, Divider, Menu, MenuItem, Typography } from '@mui/material';

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
  availableActions,
  availableLabelGroups,
  onClose,
  onAddAction,
  onAddLabel,
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
    >
      <MenuItem disabled>
        <Typography variant="caption" color="text.secondary">
          アクションボタン
        </Typography>
      </MenuItem>
      {availableActions.map((action) => (
        <MenuItem key={action} onClick={() => onAddAction(action)} sx={{ pl: 3 }}>
          {action}
        </MenuItem>
      ))}
      <MenuItem
        onClick={() => {
          if (contextMenu) {
            onOpenCustomAction(contextMenu.position);
          }
          onClose();
        }}
        sx={{ pl: 3, fontStyle: 'italic', color: 'primary.main' }}
      >
        + カスタムアクション...
      </MenuItem>
      <Divider />
      <MenuItem disabled>
        <Typography variant="caption" color="text.secondary">
          ラベルボタン
        </Typography>
      </MenuItem>
      {availableLabelGroups.map((group) => (
        <MenuItem key={group.groupName} sx={{ pl: 2 }}>
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {group.groupName}
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
              {group.options.map((option) => (
                <Typography
                  key={option}
                  variant="caption"
                  onClick={(event) => {
                    event.stopPropagation();
                    onAddLabel(group.groupName, option);
                  }}
                  sx={{
                    cursor: 'pointer',
                    backgroundColor: 'action.hover',
                    px: 1,
                    py: 0.25,
                    borderRadius: 1,
                    '&:hover': {
                      backgroundColor: 'primary.light',
                      color: 'primary.contrastText',
                    },
                  }}
                >
                  {option}
                </Typography>
              ))}
            </Box>
          </Box>
        </MenuItem>
      ))}
      <MenuItem
        onClick={() => {
          if (contextMenu) {
            onOpenCustomLabel(contextMenu.position);
          }
          onClose();
        }}
        sx={{ pl: 2, fontStyle: 'italic', color: 'secondary.main' }}
      >
        + カスタムラベル...
      </MenuItem>
    </Menu>
  );
};
