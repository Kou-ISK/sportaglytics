import React from 'react';
import type { PlaylistType } from '../../../types/playlist/core';
import { PlaylistSaveDialog } from './PlaylistSaveDialog';
import { PlaylistExportDialog } from './PlaylistExportDialog';
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
  exportDialog: React.ComponentProps<typeof PlaylistExportDialog>;
  noteDialog: {
    open: boolean;
    onClose: () => void;
    onSave: (note: string) => void;
    initialNote: string;
    itemName: string;
  };
  progress: {
    saveProgress: { current: number; total: number } | null;
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
      <PlaylistExportDialog {...exportDialog} />
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
    </>
  );
};
