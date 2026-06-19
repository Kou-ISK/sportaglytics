import React, { useCallback, useMemo, useState } from 'react';
import { Box, Divider, Stack, Typography } from '@mui/material';
import type {
  CodeWindowButton,
  CodeWindowLayout,
} from '../../../types/settings/coreTypes';
import {
  ButtonPropertiesEditor,
  buildAvailableActions,
  buildAvailableLabelGroups,
  buildSelectionButtonUpdates,
  FreeCanvasEditor,
} from '../../settings';

interface CodingPanelWindowEditPaneProps {
  layout: CodeWindowLayout | null;
  canvasHostRef: React.RefObject<HTMLDivElement | null>;
  onLayoutChange: (layout: CodeWindowLayout) => void;
}

export const CodingPanelWindowEditPane = ({
  layout,
  canvasHostRef,
  onLayoutChange,
}: CodingPanelWindowEditPaneProps): React.ReactElement => {
  const [selectedButtonIds, setSelectedButtonIds] = useState<string[]>([]);
  const availableActions = useMemo(() => buildAvailableActions(), []);
  const availableLabelGroups = useMemo(() => buildAvailableLabelGroups(), []);

  const selectedButton = useMemo((): CodeWindowButton | null => {
    if (!layout || selectedButtonIds.length === 0) return null;
    return (
      layout.buttons.find((button) => button.id === selectedButtonIds[0]) ??
      null
    );
  }, [layout, selectedButtonIds]);

  const handleSelectedButtonUpdate = useCallback(
    (updatedButton: CodeWindowButton): void => {
      if (!layout || !selectedButton) return;

      const updates =
        selectedButtonIds.length > 1
          ? buildSelectionButtonUpdates(selectedButton, updatedButton)
          : updatedButton;
      const nextButtons = layout.buttons.map((button) => {
        if (!selectedButtonIds.includes(button.id)) return button;
        return selectedButtonIds.length > 1
          ? { ...button, ...updates }
          : updatedButton;
      });
      onLayoutChange({ ...layout, buttons: nextButtons });
    },
    [layout, onLayoutChange, selectedButton, selectedButtonIds],
  );

  const handleDeleteSelectedButtons = useCallback((): void => {
    if (!layout || selectedButtonIds.length === 0) return;
    onLayoutChange({
      ...layout,
      buttons: layout.buttons.filter(
        (button) => !selectedButtonIds.includes(button.id),
      ),
      buttonLinks: (layout.buttonLinks ?? []).filter(
        (link) =>
          !selectedButtonIds.includes(link.fromButtonId) &&
          !selectedButtonIds.includes(link.toButtonId),
      ),
    });
    setSelectedButtonIds([]);
  }, [layout, onLayoutChange, selectedButtonIds]);

  return (
    <Box
      sx={{
        minHeight: 0,
        flex: 1,
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) 360px',
      }}
    >
      <Box
        ref={canvasHostRef}
        sx={{
          minWidth: 0,
          minHeight: 0,
          overflow: 'hidden',
          p: 1,
          boxSizing: 'border-box',
        }}
      >
        {layout && (
          <FreeCanvasEditor
            layout={layout}
            onLayoutChange={onLayoutChange}
            selectedButtonIds={selectedButtonIds}
            onSelectButtons={setSelectedButtonIds}
            availableActions={availableActions}
            availableLabelGroups={availableLabelGroups}
          />
        )}
      </Box>
      <Box
        sx={{
          minWidth: 0,
          minHeight: 0,
          overflow: 'auto',
          borderLeft: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Stack spacing={1.5} sx={{ p: 1.5 }}>
          <Typography variant="subtitle2">ボタン設定</Typography>
          <Divider />
          <ButtonPropertiesEditor
            button={selectedButton}
            onUpdate={handleSelectedButtonUpdate}
            onDelete={handleDeleteSelectedButtons}
            availableActions={availableActions}
            availableLabelGroups={availableLabelGroups}
            canvasWidth={layout?.canvasWidth}
            canvasHeight={layout?.canvasHeight}
          />
        </Stack>
      </Box>
    </Box>
  );
};
