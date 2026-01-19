import React from 'react';
import type { PlaylistType } from '../../../types/Playlist';
import { ExportProgressSnackbar } from '../../../components/ExportProgressSnackbar';
import { PlaylistSaveDialog } from './PlaylistSaveDialog';
import {
  PlaylistExportDialog,
  type AngleOption,
  type ExportMode,
  type OverlaySettings,
} from './PlaylistExportDialog';
import { PlaylistNoteDialog } from './PlaylistNoteDialog';
import { PlaylistSaveProgressDialog } from './PlaylistSaveProgressDialog';

type PlaylistWindowDialogsProps = {
  saveDialogOpen: boolean;
  onCloseSaveDialog: () => void;
  onSavePlaylist: (
    type: PlaylistType,
    name: string,
    shouldCloseAfterSave?: boolean,
  ) => void;
  defaultPlaylistName: string;
  defaultPlaylistType: PlaylistType;
  closeAfterSave: boolean;
  exportDialogOpen: boolean;
  onCloseExportDialog: () => void;
  onExport: () => void;
  exportFileName: string;
  setExportFileName: (value: string) => void;
  exportScope: 'all' | 'selected';
  setExportScope: (value: 'all' | 'selected') => void;
  selectedItemCount: number;
  exportMode: ExportMode;
  setExportMode: (value: ExportMode) => void;
  angleOption: AngleOption;
  setAngleOption: (value: AngleOption) => void;
  videoSources: string[];
  selectedAngleIndex: number;
  setSelectedAngleIndex: (value: number) => void;
  overlaySettings: OverlaySettings;
  setOverlaySettings: (updater: (prev: OverlaySettings) => OverlaySettings) => void;
  disableExport: boolean;
  noteDialogOpen: boolean;
  onCloseNoteDialog: () => void;
  onSaveNote: (note: string) => void;
  initialNote: string;
  itemName: string;
  saveProgress: { current: number; total: number } | null;
  exportProgress: { current: number; total: number; message: string } | null;
  onCloseExportProgress: () => void;
};

export const PlaylistWindowDialogs = ({
  saveDialogOpen,
  onCloseSaveDialog,
  onSavePlaylist,
  defaultPlaylistName,
  defaultPlaylistType,
  closeAfterSave,
  exportDialogOpen,
  onCloseExportDialog,
  onExport,
  exportFileName,
  setExportFileName,
  exportScope,
  setExportScope,
  selectedItemCount,
  exportMode,
  setExportMode,
  angleOption,
  setAngleOption,
  videoSources,
  selectedAngleIndex,
  setSelectedAngleIndex,
  overlaySettings,
  setOverlaySettings,
  disableExport,
  noteDialogOpen,
  onCloseNoteDialog,
  onSaveNote,
  initialNote,
  itemName,
  saveProgress,
  exportProgress,
  onCloseExportProgress,
}: PlaylistWindowDialogsProps) => {
  return (
    <>
      <PlaylistSaveDialog
        open={saveDialogOpen}
        onClose={onCloseSaveDialog}
        onSave={onSavePlaylist}
        defaultName={defaultPlaylistName}
        defaultType={defaultPlaylistType}
        closeAfterSave={closeAfterSave}
      />
      <PlaylistExportDialog
        open={exportDialogOpen}
        onClose={onCloseExportDialog}
        onExport={onExport}
        exportFileName={exportFileName}
        setExportFileName={setExportFileName}
        exportScope={exportScope}
        setExportScope={setExportScope}
        selectedItemCount={selectedItemCount}
        exportMode={exportMode}
        setExportMode={setExportMode}
        angleOption={angleOption}
        setAngleOption={setAngleOption}
        videoSources={videoSources}
        selectedAngleIndex={selectedAngleIndex}
        setSelectedAngleIndex={setSelectedAngleIndex}
        overlaySettings={overlaySettings}
        setOverlaySettings={setOverlaySettings}
        disableExport={disableExport}
      />
      <PlaylistNoteDialog
        open={noteDialogOpen}
        onClose={onCloseNoteDialog}
        onSave={onSaveNote}
        initialNote={initialNote}
        itemName={itemName}
      />

      <PlaylistSaveProgressDialog open={saveProgress !== null} progress={saveProgress} />

      {exportProgress && (
        <ExportProgressSnackbar
          open={!!exportProgress}
          current={exportProgress.current}
          total={exportProgress.total}
          message={exportProgress.message}
          onClose={onCloseExportProgress}
        />
      )}
    </>
  );
};
