import React, { useCallback, useMemo, useState } from 'react';
import {
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
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
import { CODING_PANEL_WINDOW_CREATION_ACTIONS_ID } from './CodingPanelWindowToolbar';

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
  const [inspectedButtonId, setInspectedButtonId] = useState<string | null>(
    null,
  );
  const availableActions = useMemo(() => buildAvailableActions(), []);
  const availableLabelGroups = useMemo(() => buildAvailableLabelGroups(), []);

  const selectedButton = useMemo((): CodeWindowButton | null => {
    if (!layout) return null;
    const targetId = inspectedButtonId ?? selectedButtonIds[0];
    if (!targetId) return null;
    return (
      layout.buttons.find((button) => button.id === targetId) ?? null
    );
  }, [inspectedButtonId, layout, selectedButtonIds]);

  const editedButtonIds = useMemo((): string[] => {
    if (!selectedButton) return [];
    return selectedButtonIds.includes(selectedButton.id)
      ? selectedButtonIds
      : [selectedButton.id];
  }, [selectedButton, selectedButtonIds]);

  const handleInspectButton = useCallback((button: CodeWindowButton): void => {
    setSelectedButtonIds((current) =>
      current.includes(button.id) ? current : [button.id],
    );
    setInspectedButtonId(button.id);
  }, []);

  const handleSelectedButtonUpdate = useCallback(
    (updatedButton: CodeWindowButton): void => {
      if (!layout || !selectedButton) return;

      const updates =
        editedButtonIds.length > 1
          ? buildSelectionButtonUpdates(selectedButton, updatedButton)
          : updatedButton;
      const nextButtons = layout.buttons.map((button) => {
        if (!editedButtonIds.includes(button.id)) return button;
        return editedButtonIds.length > 1
          ? { ...button, ...updates }
          : updatedButton;
      });
      onLayoutChange({ ...layout, buttons: nextButtons });
    },
    [editedButtonIds, layout, onLayoutChange, selectedButton],
  );

  const handleDeleteSelectedButtons = useCallback((): void => {
    if (!layout || editedButtonIds.length === 0) return;
    onLayoutChange({
      ...layout,
      buttons: layout.buttons.filter(
        (button) => !editedButtonIds.includes(button.id),
      ),
      buttonLinks: (layout.buttonLinks ?? []).filter(
        (link) =>
          !editedButtonIds.includes(link.fromButtonId) &&
          !editedButtonIds.includes(link.toButtonId),
      ),
    });
    setSelectedButtonIds([]);
    setInspectedButtonId(null);
  }, [editedButtonIds, layout, onLayoutChange]);

  const handleCloseInspector = useCallback((): void => {
    setInspectedButtonId(null);
  }, []);

  return (
    <>
      <Box
        ref={canvasHostRef}
        sx={{
          minWidth: 0,
          minHeight: 0,
          flex: 1,
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
            onInspectButton={handleInspectButton}
            showCreationToolbar
            creationToolbarTargetId={CODING_PANEL_WINDOW_CREATION_ACTIONS_ID}
          />
        )}
      </Box>

      <Dialog
        open={Boolean(inspectedButtonId && selectedButton)}
        onClose={handleCloseInspector}
        maxWidth={false}
        PaperProps={{
          sx: {
            width: 420,
            maxWidth: 'calc(100vw - 32px)',
            maxHeight: 'calc(100vh - 48px)',
          },
        }}
      >
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            pr: 6,
            py: 1.25,
          }}
        >
          <Stack spacing={0} sx={{ minWidth: 0 }}>
            <Typography variant="subtitle1" noWrap>
              ボタン Inspector
            </Typography>
            {editedButtonIds.length > 1 && (
              <Typography variant="caption" color="text.secondary">
                {editedButtonIds.length} 個の選択ボタンへ適用
              </Typography>
            )}
          </Stack>
          <IconButton
            aria-label="閉じる"
            onClick={handleCloseInspector}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent
          dividers
          sx={{
            p: 1,
            overflow: 'auto',
            '& > .MuiPaper-root': {
              p: 1.25,
              borderRadius: 1,
            },
            '& .MuiTabs-root': {
              minHeight: 32,
              mb: 0.5,
            },
            '& .MuiTab-root': {
              minHeight: 32,
              py: 0.5,
              fontSize: '0.75rem',
            },
            '& .MuiFormControl-root, & .MuiTextField-root': {
              mb: '8px !important',
            },
            '& .MuiInputBase-root': {
              minHeight: 34,
              fontSize: '0.82rem',
            },
            '& .MuiInputLabel-root': {
              fontSize: '0.82rem',
            },
            '& .MuiMenuItem-root': {
              minHeight: 30,
              fontSize: '0.82rem',
            },
            '& .MuiTypography-subtitle1': {
              fontSize: '0.92rem',
            },
            '& .MuiTypography-subtitle2': {
              mb: 0.5,
              fontSize: '0.8rem',
            },
            '& .MuiTypography-caption': {
              fontSize: '0.68rem',
            },
            '& .MuiDivider-root': {
              my: '10px !important',
            },
            '& .MuiChip-root': {
              height: 22,
              fontSize: '0.7rem',
            },
            '& .MuiToggleButton-root': {
              py: 0.5,
            },
            '& .MuiSlider-root': {
              py: 0.75,
            },
          }}
        >
          <ButtonPropertiesEditor
            button={selectedButton}
            onUpdate={handleSelectedButtonUpdate}
            onDelete={handleDeleteSelectedButtons}
            availableActions={availableActions}
            availableLabelGroups={availableLabelGroups}
            canvasWidth={layout?.canvasWidth}
            canvasHeight={layout?.canvasHeight}
          />
        </DialogContent>
      </Dialog>
    </>
  );
};
