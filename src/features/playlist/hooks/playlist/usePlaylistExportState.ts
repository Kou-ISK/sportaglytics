import { useState } from 'react';
import {
  DEFAULT_CLIP_EXPORT_OVERLAY_SETTINGS,
  type ClipExportAngleOption,
  type ClipExportMode,
  type ClipExportOverlaySettings,
  type ClipExportScope,
} from '../../../../shared/clipExport/clipExportTypes';

interface UsePlaylistExportStateResult {
  exportDialogOpen: boolean;
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
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [overlaySettings, setOverlaySettings] =
    useState<ClipExportOverlaySettings>(
      DEFAULT_CLIP_EXPORT_OVERLAY_SETTINGS,
    );
  const [exportMode, setExportMode] = useState<ClipExportMode>('single');
  const [angleOption, setAngleOption] = useState<ClipExportAngleOption>('single');
  const [selectedAngleIndex, setSelectedAngleIndex] = useState<number>(0);
  const [exportFileName, setExportFileName] = useState('');
  const [exportScope, setExportScope] = useState<ClipExportScope>('all');

  return {
    exportDialogOpen,
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
