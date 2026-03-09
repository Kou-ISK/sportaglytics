import type { DrawingObject, ItemAnnotation, PlaylistItem, PlaylistType } from '../../../../types/Playlist';
import type { AnnotationCanvasRef } from '../../components/AnnotationCanvas';
import type { AngleOption, ExportMode, OverlaySettings } from '../../components/PlaylistExportDialog';

export type PlaylistViewMode = 'dual' | 'angle1' | 'angle2';
export type PlaylistDndSensors = ReturnType<typeof import('@dnd-kit/core').useSensors>;

export interface BuildHeaderSectionParams {
  playlistName: string;
  hasUnsavedChanges: boolean;
  exportInProgress: boolean;
  hasDualSources: boolean;
  anchorEl: HTMLElement | null;
  onMenuOpen: (event: React.MouseEvent<HTMLElement>) => void;
  onMenuClose: () => void;
  onSaveClick: () => void;
  onLoadClick: () => void;
  onViewModeChange: (mode: PlaylistViewMode) => void;
  setSaveDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setExportDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export interface BuildVideoAreaSectionParams {
  currentVideoSource: string | null;
  currentVideoSource2: string | null;
  viewMode: PlaylistViewMode;
  isDrawingMode: boolean;
  drawingTarget: 'primary' | 'secondary';
  onDrawingTargetChange: (target: 'primary' | 'secondary') => void;
  annotationCanvasRefPrimary: React.RefObject<AnnotationCanvasRef | null>;
  annotationCanvasRefSecondary: React.RefObject<AnnotationCanvasRef | null>;
  primaryCanvasSize: { width: number; height: number };
  secondaryCanvasSize: { width: number; height: number };
  primaryContentRect: {
    width: number;
    height: number;
    offsetX: number;
    offsetY: number;
  };
  secondaryContentRect: {
    width: number;
    height: number;
    offsetX: number;
    offsetY: number;
  };
  currentAnnotation: ItemAnnotation | null;
  defaultFreezeDuration: number;
  onObjectsChange: (objects: DrawingObject[], target?: 'primary' | 'secondary') => void;
  onFreezeDurationChange: (freezeDuration: number) => void;
  currentTime: number;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  videoRef2: React.RefObject<HTMLVideoElement | null>;
  hasItems: boolean;
  controlsVisible: boolean;
  sliderMin: number;
  sliderMax: number;
  marks: { value: number; label: string }[];
  isPlaying: boolean;
  isFrozen: boolean;
  autoAdvance: boolean;
  loopPlaylist: boolean;
  isMuted: boolean;
  volume: number;
  isFullscreen: boolean;
  onSeek: (event: Event, value: number | number[]) => void;
  onSeekCommitted: () => void;
  onPrevious: () => void;
  onTogglePlay: () => void;
  onNext: () => void;
  onToggleAutoAdvance: () => void;
  onToggleLoop: () => void;
  onToggleDrawingMode: () => void;
  onToggleMute: () => void;
  onVolumeChange: (event: Event, value: number | number[]) => void;
  onToggleFullscreen: () => void;
  onVideoAreaHoverChange: (hovered: boolean) => void;
  onVideoAreaInteraction: () => void;
}

export interface BuildItemSectionParams {
  items: PlaylistItem[];
  currentIndex: number;
  selectedItemIds: Set<string>;
  sensors: PlaylistDndSensors;
  onDragEnd: (event: import('@dnd-kit/core').DragEndEvent) => void;
  onRemove: (id: string) => void;
  onPlay: (id?: string) => void;
  onEditNote: (itemId: string) => void;
  onToggleSelect: (id: string) => void;
}

export interface BuildDialogsSectionParams {
  saveDialogOpen: boolean;
  onCloseSaveDialog: () => void;
  onSavePlaylistAs: (
    type: PlaylistType,
    name: string,
    shouldCloseAfterSave?: boolean,
  ) => void;
  playlistName: string;
  playlistType: PlaylistType;
  closeAfterSave: boolean;
  exportDialogOpen: boolean;
  onCloseExportDialog: () => void;
  onExportPlaylist: () => void;
  exportFileName: string;
  setExportFileName: React.Dispatch<React.SetStateAction<string>>;
  exportScope: 'all' | 'selected';
  setExportScope: React.Dispatch<React.SetStateAction<'all' | 'selected'>>;
  selectedCount: number;
  exportMode: ExportMode;
  setExportMode: React.Dispatch<React.SetStateAction<ExportMode>>;
  angleOption: AngleOption;
  setAngleOption: React.Dispatch<React.SetStateAction<AngleOption>>;
  videoSources: string[];
  selectedAngleIndex: number;
  setSelectedAngleIndex: React.Dispatch<React.SetStateAction<number>>;
  overlaySettings: OverlaySettings;
  setOverlaySettings: React.Dispatch<React.SetStateAction<OverlaySettings>>;
  exportInProgress: boolean;
  noteDialogOpen: boolean;
  onCloseNoteDialog: () => void;
  onSaveNote: (note: string) => void;
  initialNote: string;
  itemName: string;
  saveProgress: { current: number; total: number } | null;
  exportProgress: { current: number; total: number; message: string } | null;
  onCloseExportProgress: () => void;
}

export interface BuildNowPlayingSectionParams {
  currentItem: PlaylistItem | null;
  isFrozen: boolean;
  currentIndex: number;
  totalCount: number;
  currentAnnotation: ItemAnnotation | null;
}
