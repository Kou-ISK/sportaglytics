import { useClipExportDialogState } from '../../../../shared/clipExport/useClipExportDialogState';
import { useEffect, useState } from 'react';
import { subscribeClipExportMenuRequest } from '../../../../shared/clipExport/clipExportGateway';
import {
  type ClipExportAngleOption,
  type ClipExportMode,
  type ClipExportOverlaySettings,
  type ClipExportScope,
} from '../../../../shared/clipExport/clipExportTypes';

interface UsePlaylistExportStateResult {
  exportDialogOpen: boolean;
  overlayChoice: boolean | null;
  chooseOverlay: (enabled: boolean) => void;
  setExportDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  overlaySettings: ClipExportOverlaySettings;
  setOverlaySettings: React.Dispatch<
    React.SetStateAction<ClipExportOverlaySettings>
  >;
  exportMode: ClipExportMode;
  setExportMode: React.Dispatch<React.SetStateAction<ClipExportMode>>;
  angleOption: ClipExportAngleOption;
  setAngleOption: React.Dispatch<React.SetStateAction<ClipExportAngleOption>>;
  selectedAngleIndex: number;
  setSelectedAngleIndex: React.Dispatch<React.SetStateAction<number>>;
  exportFileName: string;
  setExportFileName: React.Dispatch<React.SetStateAction<string>>;
  exportScope: ClipExportScope;
  setExportScope: React.Dispatch<React.SetStateAction<ClipExportScope>>;
}

export const usePlaylistExportState = (): UsePlaylistExportStateResult => {
  const {
    open: exportDialogOpen,
    setOpen: setExportDialogOpen,
    overlaySettings,
    setOverlaySettings,
    overlayChoice,
    chooseOverlay,
  } = useClipExportDialogState();
  const [exportMode, setExportMode] = useState<ClipExportMode>('single');
  const [angleOption, setAngleOption] =
    useState<ClipExportAngleOption>('defaultAngles');
  const [selectedAngleIndex, setSelectedAngleIndex] = useState<number>(0);
  const [exportFileName, setExportFileName] = useState('');
  const [exportScope, setExportScope] = useState<ClipExportScope>('all');

  useEffect(
    () => subscribeClipExportMenuRequest(() => setExportDialogOpen(true)),
    [setExportDialogOpen],
  );

  return {
    exportDialogOpen,
    overlayChoice,
    chooseOverlay,
    setExportDialogOpen,
    overlaySettings,
    setOverlaySettings,
    exportMode,
    setExportMode,
    angleOption,
    setAngleOption,
    selectedAngleIndex,
    setSelectedAngleIndex,
    exportFileName,
    setExportFileName,
    exportScope,
    setExportScope,
  };
};
