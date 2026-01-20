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
  saveDialog: {
    open: boolean;
    onClose: () => void;
    onSave: (
      type: PlaylistType,
      name: string,
      shouldCloseAfterSave?: boolean,
    ) => void;
    defaultName: string;
    defaultType: PlaylistType;
    closeAfterSave: boolean;
  };
  exportDialog: {
    open: boolean;
    onClose: () => void;
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
    setOverlaySettings: (
      updater: (prev: OverlaySettings) => OverlaySettings,
    ) => void;
    disableExport: boolean;
  };
  noteDialog: {
    open: boolean;
    onClose: () => void;
    onSave: (note: string) => void;
    initialNote: string;
    itemName: string;
  };
  progress: {
    saveProgress: { current: number; total: number } | null;
    exportProgress: { current: number; total: number; message: string } | null;
    onCloseExportProgress: () => void;
  };
};

export const PlaylistWindowDialogs = ({
  saveDialog,
  exportDialog,
  noteDialog,
  progress,
}: PlaylistWindowDialogsProps) => {
  return (
    <>
      <PlaylistSaveDialog
        open={saveDialog.open}
        onClose={saveDialog.onClose}
        onSave={saveDialog.onSave}
        defaultName={saveDialog.defaultName}
        defaultType={saveDialog.defaultType}
        closeAfterSave={saveDialog.closeAfterSave}
      />
      <PlaylistExportDialog
        open={exportDialog.open}
        onClose={exportDialog.onClose}
        onExport={exportDialog.onExport}
        exportFileName={exportDialog.exportFileName}
        setExportFileName={exportDialog.setExportFileName}
        exportScope={exportDialog.exportScope}
        setExportScope={exportDialog.setExportScope}
        selectedItemCount={exportDialog.selectedItemCount}
        exportMode={exportDialog.exportMode}
        setExportMode={exportDialog.setExportMode}
        angleOption={exportDialog.angleOption}
        setAngleOption={exportDialog.setAngleOption}
        videoSources={exportDialog.videoSources}
        selectedAngleIndex={exportDialog.selectedAngleIndex}
        setSelectedAngleIndex={exportDialog.setSelectedAngleIndex}
        overlaySettings={exportDialog.overlaySettings}
        setOverlaySettings={exportDialog.setOverlaySettings}
        disableExport={exportDialog.disableExport}
      />
      <PlaylistNoteDialog
        open={noteDialog.open}
        onClose={noteDialog.onClose}
        onSave={noteDialog.onSave}
        initialNote={noteDialog.initialNote}
        itemName={noteDialog.itemName}
      />

      <PlaylistSaveProgressDialog
        open={progress.saveProgress !== null}
        progress={progress.saveProgress}
      />

      {progress.exportProgress && (
        <ExportProgressSnackbar
          open={!!progress.exportProgress}
          current={progress.exportProgress.current}
          total={progress.exportProgress.total}
          message={progress.exportProgress.message}
          onClose={progress.onCloseExportProgress}
        />
      )}
    </>
  );
};
