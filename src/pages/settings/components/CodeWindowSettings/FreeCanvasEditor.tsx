import React, { useCallback, useRef } from 'react';
import { Box } from '@mui/material';
import type { CodeWindowLayout } from '../../../../types/Settings';
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
}

export const FreeCanvasEditor: React.FC<FreeCanvasEditorProps> = ({
  layout,
  onLayoutChange,
  selectedButtonIds,
  onSelectButtons,
  availableActions,
  availableLabelGroups,
  showLinks = true,
}) => {
  const gridSize = 10;
  const canvasRef = useRef<HTMLDivElement>(null);
  const selectedPrimaryId = selectedButtonIds[0] ?? null;

  const {
    selectedLinkId,
    setSelectedLinkId,
    updateLayoutWithHistory,
  } = useFreeCanvasHistoryAndShortcuts({
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
    handleButtonMouseDown,
    handleButtonRightMouseDown,
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

  return (
    <Box>
      <FreeCanvasStage
        canvasRef={canvasRef}
        layout={layout}
        dragMode={dragMode}
        draggedButton={draggedButton}
        linkStartButton={linkStartButton}
        selectedButtonIds={selectedButtonIds}
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
        onCanvasClick={handleCanvasClick}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onContextMenu={handleContextMenu}
        onButtonMouseDown={handleButtonMouseDown}
        onButtonRightMouseDown={handleButtonRightMouseDown}
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
