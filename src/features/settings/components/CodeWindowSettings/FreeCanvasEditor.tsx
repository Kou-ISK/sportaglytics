import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Box, Button, Stack } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import LabelIcon from '@mui/icons-material/Label';
import type {
  CodeWindowButton,
  CodeWindowLayout,
} from '../../../../types/settings/coreTypes';
import { FreeCanvasContextMenu } from './FreeCanvasContextMenu';
import { FreeCanvasCustomActionDialog } from './FreeCanvasCustomActionDialog';
import { FreeCanvasCustomLabelDialog } from './FreeCanvasCustomLabelDialog';
import { useFreeCanvasButtonCreation } from './hooks/useFreeCanvasButtonCreation';
import { useFreeCanvasHistoryAndShortcuts } from './hooks/useFreeCanvasHistoryAndShortcuts';
import { useFreeCanvasInteractions } from './hooks/useFreeCanvasInteractions';
import {
  renderCanvasDraggingLink,
  renderCanvasLinks,
} from './freeCanvasLinkRenderers';
import { FreeCanvasStage } from './FreeCanvasStage';

interface FreeCanvasEditorProps {
  layout: CodeWindowLayout;
  onLayoutChange: (layout: CodeWindowLayout) => void;
  selectedButtonIds: string[];
  onSelectButtons: (ids: string[]) => void;
  availableActions: string[];
  availableLabelGroups: Array<{ groupName: string; options: string[] }>;
  showLinks?: boolean;
  onInspectButton?: (button: CodeWindowButton) => void;
  showCreationToolbar?: boolean;
  creationToolbarTargetId?: string;
}

export const FreeCanvasEditor: React.FC<FreeCanvasEditorProps> = ({
  layout,
  onLayoutChange,
  selectedButtonIds,
  onSelectButtons,
  availableActions,
  availableLabelGroups,
  showLinks = true,
  onInspectButton,
  showCreationToolbar = false,
  creationToolbarTargetId,
}) => {
  const gridSize = 10;
  const canvasRef = useRef<HTMLDivElement>(null);
  const [creationToolbarTarget, setCreationToolbarTarget] =
    useState<HTMLElement | null>(null);
  const selectedPrimaryId = selectedButtonIds[0] ?? null;

  const { selectedLinkId, setSelectedLinkId, updateLayoutWithHistory } =
    useFreeCanvasHistoryAndShortcuts({
      layout,
      selectedButtonIds,
      selectedPrimaryId,
      onLayoutChange,
      onSelectButtons,
    });

  const getCanvasPosition = useCallback(
    (event: React.MouseEvent | MouseEvent): { x: number; y: number } => {
      if (!canvasRef.current) return { x: 0, y: 0 };
      const rect = canvasRef.current.getBoundingClientRect();
      return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
    },
    [],
  );

  const {
    contextMenu,
    customActionDialogOpen,
    customActionName,
    customLabelDialogOpen,
    customLabelGroup,
    customLabelValue,
    setCustomActionDialogOpen,
    setCustomActionName,
    setCustomLabelDialogOpen,
    setCustomLabelGroup,
    setCustomLabelValue,
    handleContextMenu,
    handleCloseContextMenu,
    handleAddButton,
    handleOpenCustomActionDialog,
    handleOpenCustomLabelDialog,
    handleConfirmCustomAction,
    handleConfirmCustomLabel,
  } = useFreeCanvasButtonCreation({
    layout,
    onSelectButtons,
    updateLayoutWithHistory,
    getCanvasPosition,
    gridSize,
  });

  const {
    dragMode,
    draggedButton,
    linkEndPos,
    linkStartButton,
    linkType,
    rangeSelectionBox,
    handleButtonMouseDown,
    handleButtonRightMouseDown,
    handleCanvasMouseDown,
    handleCanvasClick,
    handleDeleteButton,
    handleMouseMove,
    handleMouseUp,
    handleSelectLink,
  } = useFreeCanvasInteractions({
    canvasRef,
    gridSize,
    layout,
    selectedButtonIds,
    onLayoutChange,
    onSelectButtons,
    setSelectedLinkId,
    updateLayoutWithHistory,
    getCanvasPosition,
  });

  useEffect(() => {
    if (!creationToolbarTargetId) {
      setCreationToolbarTarget(null);
      return;
    }
    setCreationToolbarTarget(document.getElementById(creationToolbarTargetId));
  }, [creationToolbarTargetId]);

  const creationToolbar = showCreationToolbar ? (
    <Stack direction="row" spacing={0.25}>
      <Button
        size="small"
        variant="outlined"
        startIcon={<AddIcon />}
        onClick={() => handleOpenCustomActionDialog({ x: 20, y: 20 })}
        sx={{
          minWidth: 0,
          minHeight: 24,
          px: 0.5,
          py: 0.125,
          fontSize: '0.66rem',
          lineHeight: 1.1,
          '& .MuiButton-startIcon': {
            mr: 0.25,
            ml: 0,
          },
          '& .MuiSvgIcon-root': {
            fontSize: 14,
          },
        }}
      >
        アクション
      </Button>
      <Button
        size="small"
        variant="outlined"
        color="secondary"
        startIcon={<LabelIcon />}
        onClick={() => handleOpenCustomLabelDialog({ x: 20, y: 20 })}
        sx={{
          minWidth: 0,
          minHeight: 24,
          px: 0.5,
          py: 0.125,
          fontSize: '0.66rem',
          lineHeight: 1.1,
          '& .MuiButton-startIcon': {
            mr: 0.25,
            ml: 0,
          },
          '& .MuiSvgIcon-root': {
            fontSize: 14,
          },
        }}
      >
        ラベル
      </Button>
    </Stack>
  ) : null;

  return (
    <Box sx={{ position: 'relative', width: layout.canvasWidth }}>
      {creationToolbarTarget && creationToolbar
        ? createPortal(creationToolbar, creationToolbarTarget)
        : creationToolbarTargetId
          ? null
          : creationToolbar}
      <FreeCanvasStage
        canvasRef={canvasRef}
        layout={layout}
        dragMode={dragMode}
        draggedButton={draggedButton}
        linkStartButton={linkStartButton}
        selectedButtonIds={selectedButtonIds}
        rangeSelectionBox={rangeSelectionBox}
        links={renderCanvasLinks({
          layout,
          showLinks,
          selectedLinkId,
          selectedPrimaryId,
          onSelectLink: handleSelectLink,
        })}
        draggingLink={renderCanvasDraggingLink({
          linkStartButton,
          linkEndPos,
          linkType,
        })}
        onCanvasMouseDown={handleCanvasMouseDown}
        onCanvasClick={handleCanvasClick}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onContextMenu={handleContextMenu}
        onButtonMouseDown={handleButtonMouseDown}
        onButtonRightMouseDown={handleButtonRightMouseDown}
        onButtonInspect={onInspectButton}
        onDeleteButton={handleDeleteButton}
      />

      <FreeCanvasContextMenu
        contextMenu={contextMenu}
        availableActions={availableActions}
        availableLabelGroups={availableLabelGroups}
        onClose={handleCloseContextMenu}
        onAddAction={(action) => handleAddButton('action', action)}
        onAddLabel={(groupName, option) =>
          handleAddButton('label', groupName, option)
        }
        onOpenCustomAction={handleOpenCustomActionDialog}
        onOpenCustomLabel={handleOpenCustomLabelDialog}
      />

      <FreeCanvasCustomActionDialog
        open={customActionDialogOpen}
        onClose={() => setCustomActionDialogOpen(false)}
        actionName={customActionName}
        onActionNameChange={setCustomActionName}
        onConfirm={handleConfirmCustomAction}
      />

      <FreeCanvasCustomLabelDialog
        open={customLabelDialogOpen}
        onClose={() => setCustomLabelDialogOpen(false)}
        labelGroup={customLabelGroup}
        labelValue={customLabelValue}
        onLabelGroupChange={setCustomLabelGroup}
        onLabelValueChange={setCustomLabelValue}
        onConfirm={handleConfirmCustomLabel}
      />
    </Box>
  );
};
