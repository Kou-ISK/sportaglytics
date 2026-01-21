import { useState } from 'react';

interface OverlaySettings {
  enabled: boolean;
  showActionName: boolean;
  showActionIndex: boolean;
  showLabels: boolean;
  showMemo: boolean;
}

interface UsePlaylistExportStateResult {
  exportDialogOpen: boolean;
  setExportDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  overlaySettings: OverlaySettings;
  setOverlaySettings: React.Dispatch<React.SetStateAction<OverlaySettings>>;
  exportMode: 'single' | 'perInstance' | 'perRow';
  setExportMode: React.Dispatch<
    React.SetStateAction<'single' | 'perInstance' | 'perRow'>
  >;
  angleOption: 'allAngles' | 'single' | 'multi';
  setAngleOption: React.Dispatch<
    React.SetStateAction<'allAngles' | 'single' | 'multi'>
  >;
  selectedAngleIndex: number;
  setSelectedAngleIndex: React.Dispatch<React.SetStateAction<number>>;
  exportFileName: string;
  setExportFileName: React.Dispatch<React.SetStateAction<string>>;
  exportScope: 'all' | 'selected';
  setExportScope: React.Dispatch<React.SetStateAction<'all' | 'selected'>>;
}

export const usePlaylistExportState = (): UsePlaylistExportStateResult => {
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [overlaySettings, setOverlaySettings] = useState<OverlaySettings>({
    enabled: true,
    showActionName: true,
    showActionIndex: true,
    showLabels: true,
    showMemo: true,
  });
  const [exportMode, setExportMode] = useState<
    'single' | 'perInstance' | 'perRow'
  >('single');
  const [angleOption, setAngleOption] = useState<
    'allAngles' | 'single' | 'multi'
  >('single');
  const [selectedAngleIndex, setSelectedAngleIndex] = useState<number>(0);
  const [exportFileName, setExportFileName] = useState('');
  const [exportScope, setExportScope] = useState<'all' | 'selected'>('all');

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
