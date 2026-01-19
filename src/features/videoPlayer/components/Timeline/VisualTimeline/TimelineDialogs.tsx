import React from 'react';
import { TimelineData } from '../../../../../types/TimelineData';
import { TimelineEditDialog, TimelineEditDraft } from './TimelineEditDialog';
import { TimelineContextMenu } from './TimelineContextMenu';
import { TimelineLabelDialog } from './TimelineLabelDialog';
import { TimelineClipExportDialog } from './TimelineClipExportDialog';
import { TimelineExportProgressDialog } from './TimelineExportProgressDialog';

interface TimelineDialogsProps {
  editingDraft: TimelineEditDraft | null;
  onDialogChange: (changes: Partial<TimelineEditDraft>) => void;
  onCloseDialog: () => void;
  onDeleteSingle: () => void;
  onSaveDialog: () => void;
  contextMenu: { position: { top: number; left: number }; itemId: string } | null;
  onCloseContextMenu: () => void;
  onContextMenuEdit: () => void;
  onContextMenuDelete: () => void;
  onContextMenuJumpTo: () => void;
  onContextMenuDuplicate: () => void;
  onAddToPlaylist?: (items: TimelineData[]) => void;
  timeline: TimelineData[];
  selectedIds: string[];
  labelDialogOpen: boolean;
  labelGroup: string;
  labelName: string;
  onLabelGroupChange: (value: string) => void;
  onLabelNameChange: (value: string) => void;
  onCloseLabelDialog: () => void;
  onApplyLabel: () => void;
  clipDialogOpen: boolean;
  onCloseClipDialog: () => void;
  onExportClips: () => void;
  exportScope: 'selected' | 'all';
  setExportScope: React.Dispatch<React.SetStateAction<'selected' | 'all'>>;
  exportMode: 'single' | 'perInstance' | 'perRow';
  setExportMode: React.Dispatch<
    React.SetStateAction<'single' | 'perInstance' | 'perRow'>
  >;
  exportFileName: string;
  setExportFileName: React.Dispatch<React.SetStateAction<string>>;
  angleOption: 'allAngles' | 'single' | 'multi';
  setAngleOption: React.Dispatch<
    React.SetStateAction<'allAngles' | 'single' | 'multi'>
  >;
  selectedAngleIndex: number;
  setSelectedAngleIndex: React.Dispatch<React.SetStateAction<number>>;
  videoSources?: string[];
  primarySource?: string;
  secondarySource?: string;
  setPrimarySource: React.Dispatch<React.SetStateAction<string | undefined>>;
  setSecondarySource: React.Dispatch<React.SetStateAction<string | undefined>>;
  isExporting: boolean;
}

export const TimelineDialogs: React.FC<TimelineDialogsProps> = ({
  editingDraft,
  onDialogChange,
  onCloseDialog,
  onDeleteSingle,
  onSaveDialog,
  contextMenu,
  onCloseContextMenu,
  onContextMenuEdit,
  onContextMenuDelete,
  onContextMenuJumpTo,
  onContextMenuDuplicate,
  onAddToPlaylist,
  timeline,
  selectedIds,
  labelDialogOpen,
  labelGroup,
  labelName,
  onLabelGroupChange,
  onLabelNameChange,
  onCloseLabelDialog,
  onApplyLabel,
  clipDialogOpen,
  onCloseClipDialog,
  onExportClips,
  exportScope,
  setExportScope,
  exportMode,
  setExportMode,
  exportFileName,
  setExportFileName,
  angleOption,
  setAngleOption,
  selectedAngleIndex,
  setSelectedAngleIndex,
  videoSources,
  primarySource,
  secondarySource,
  setPrimarySource,
  setSecondarySource,
  isExporting,
}) => {
  const handleAddToPlaylist = onAddToPlaylist
    ? () => {
        const items = timeline.filter((item) => selectedIds.includes(item.id));
        if (items.length > 0) {
          onAddToPlaylist(items);
        }
      }
    : undefined;

  return (
    <>
      <TimelineEditDialog
        draft={editingDraft}
        open={Boolean(editingDraft)}
        onChange={onDialogChange}
        onClose={onCloseDialog}
        onDelete={onDeleteSingle}
        onSave={onSaveDialog}
      />

      <TimelineContextMenu
        anchorPosition={contextMenu?.position || null}
        onClose={onCloseContextMenu}
        onEdit={onContextMenuEdit}
        onDelete={onContextMenuDelete}
        onJumpTo={onContextMenuJumpTo}
        onDuplicate={onContextMenuDuplicate}
        onAddToPlaylist={handleAddToPlaylist}
        selectedCount={selectedIds.length}
      />

      <TimelineLabelDialog
        open={labelDialogOpen}
        selectedCount={selectedIds.length}
        labelGroup={labelGroup}
        labelName={labelName}
        onLabelGroupChange={onLabelGroupChange}
        onLabelNameChange={onLabelNameChange}
        onClose={onCloseLabelDialog}
        onApply={onApplyLabel}
      />

      <TimelineClipExportDialog
        open={clipDialogOpen}
        onClose={onCloseClipDialog}
        onExport={onExportClips}
        exportScope={exportScope}
        setExportScope={setExportScope}
        selectedCount={selectedIds.length}
        exportMode={exportMode}
        setExportMode={setExportMode}
        exportFileName={exportFileName}
        setExportFileName={setExportFileName}
        angleOption={angleOption}
        setAngleOption={setAngleOption}
        selectedAngleIndex={selectedAngleIndex}
        setSelectedAngleIndex={setSelectedAngleIndex}
        videoSources={videoSources}
        primarySource={primarySource}
        secondarySource={secondarySource}
        setPrimarySource={setPrimarySource}
        setSecondarySource={setSecondarySource}
      />

      <TimelineExportProgressDialog open={isExporting} />
    </>
  );
};
