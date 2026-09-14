import { readVideoGrassKey } from './readVideoGrassKey';
import { useTacticsPresets } from './useTacticsPresets';
import { useTacticsChroma } from './useTacticsChroma';
import { usePitchCalibration } from './usePitchCalibration';
import type { PitchCalibrationControls } from './usePitchCalibration';
import type { StudioContentRect } from './useStudioGesture';
import { useTacticsTracking } from './tracking/useTacticsTracking';
import type { TacticsTimelineProps } from './TacticsTimelineView';
import { useMemo, useRef, useState } from 'react';
import type { AnnotationTarget } from '../../../types/playlist/core';
import type { PlaylistWorkspaceMode } from '../../../types/playlist/window';
import type { PlaylistWindowRuntime } from '../hooks/playlist/usePlaylistWindowRuntime';
import { useStudioEditor } from './useStudioEditor';
import type { StudioEditor } from './useStudioEditor';
import type {
  TacticsInspectorPanel,
  StudioSidebarViewProps,
} from './StudioSidebarView';
import type { StudioTransportViewProps } from './StudioTransportView';
import type { StudioCoachViewProps } from './StudioCoachView';
import type { StudioClipsViewProps } from './StudioClipsView';

interface PlaylistStudio {
  active: boolean;
  pitch: PitchCalibrationControls;
  contentRect: StudioContentRect;
  timeline: TacticsTimelineProps;
  coachMode: boolean;
  coach: StudioCoachViewProps;
  canvas: StudioEditor['canvas'];
  sidebar: StudioSidebarViewProps;
  transport: StudioTransportViewProps;
  clips: StudioClipsViewProps;
  onModeChange: (mode: PlaylistWorkspaceMode) => void;
}
export const usePlaylistStudio = (
  runtime: PlaylistWindowRuntime,
): PlaylistStudio => {
  const { core, annotations, currentItemState, history, playback } = runtime;
  const [grassError, setGrassError] = useState('');
  const [panel, setPanel] = useState<TacticsInspectorPanel>('draw');
  const [coachMode, setCoachMode] = useState(false);
  const [seekRevision, setSeekRevision] = useState(0);
  const previousView = useRef(core.viewMode);
  const active = core.workspaceMode === 'studio';
  const target = core.drawingTarget;
  const secondary = target === 'secondary';
  const item = currentItemState.currentItem;
  const objects = useMemo(
    () =>
      annotations.currentAnnotation?.objects.filter(
        (object) => (object.target || 'primary') === target,
      ) ?? [],
    [annotations.currentAnnotation, target],
  );
  const seek = (time: number): void => {
    setSeekRevision((value) => value + 1);
    if (core.isPlaying) core.setIsPlaying(false);
    playback.handleSeek(new Event('studio-seek'), time);
  };
  const selectClip = (id: string): void => {
    playback.handlePlayItem(id);
    core.setIsPlaying(false);
  };
  const togglePlayback = (): void => {
    if (!item || !currentItemState.currentVideoSource) return;
    if (core.isPlaying || core.isFrozen) seek(core.currentTime);
    else playback.handleTogglePlay();
  };
  const editor = useStudioEditor({
    seekRevision,
    onToolSelected: () => setPanel('draw'),
    onTogglePlayback: togglePlayback,
    chromaKey: annotations.currentAnnotation?.chromaKey?.[target],
    videoRef: secondary ? core.videoRef2 : core.videoRef,
    documentKey: `${core.loadedFilePath}:${item?.id}:${target}`,
    enabled:
      active &&
      Boolean(item && currentItemState.currentVideoSource) &&
      !core.isPlaying &&
      !core.isFrozen,
    objects,
    time: core.currentTime,
    maxTime: currentItemState.sliderMax,
    target,
    ...(secondary ? core.secondaryCanvasSize : core.primaryCanvasSize),
    contentRect: secondary
      ? core.secondaryContentRect
      : core.primaryContentRect,
    onCommit: (next) => {
      let grassKey = annotations.currentAnnotation?.chromaKey?.[target];
      if (
        !grassKey &&
        !objects.some((object) =>
          ['disc', 'ring', 'linkedDiscs', 'beam'].includes(object.type),
        ) &&
        next.some(
          (object) =>
            ['disc', 'ring', 'linkedDiscs', 'beam'].includes(object.type) &&
            !objects.some((previous) => previous.id === object.id),
        )
      ) {
        try {
          grassKey = readVideoGrassKey(
            (secondary ? core.videoRef2 : core.videoRef).current,
          );
          setGrassError('');
        } catch {
          setGrassError(
            '芝色を取得できませんでした。ピッチの「選手の背後に描画」で調整してください。',
          );
        }
      }
      annotations.handleAnnotationObjectsChange(next, target, grassKey);
    },
    onSeek: seek,
    onUndo: runtime.handleUndo,
    onRedo: runtime.handleRedo,
    canUndo: history.canUndo,
    canRedo: history.canRedo,
  });
  const contentRect = secondary
    ? core.secondaryContentRect
    : core.primaryContentRect;
  const trackingSelection = editor.inspector.selected
    ? {
        ...editor.inspector.selected,
        baseWidth: editor.inspector.selected.baseWidth ?? contentRect.width,
        baseHeight: editor.inspector.selected.baseHeight ?? contentRect.height,
      }
    : null;
  const tracking = useTacticsTracking({
    documentKey: `${core.loadedFilePath}:${item?.id}:${target}`,
    source: () =>
      (secondary ? core.videoRef2 : core.videoRef).current?.currentSrc,
    selected: trackingSelection,
    time: core.currentTime,
    endTime: currentItemState.sliderMax,
    enabled: editor.inspector.enabled,
    onApply: editor.inspector.onUpdate,
  });
  const pitch = usePitchCalibration({
    documentKey: `${core.loadedFilePath}:${item?.id}:${target}`,
    enabled: editor.inspector.enabled,
    calibration: annotations.currentAnnotation?.pitchCalibration?.[target],
    selected: editor.inspector.selected,
    contentRect,
    time: core.currentTime,
    onSave: (value) => annotations.handlePitchCalibrationChange(value, target),
    onAdd: (object) =>
      annotations.handleAnnotationObjectsChange(
        [...objects, { ...object, target }],
        target,
      ),
  });
  const chroma = useTacticsChroma(
    annotations.currentAnnotation?.chromaKey?.[target],
    !editor.inspector.enabled,
    () => (secondary ? core.videoRef2 : core.videoRef).current,
    (value) => annotations.handleChromaKeyChange(value, target),
  );
  const presets = useTacticsPresets(
    editor.inspector.selected,
    editor.inspector.enabled,
    core.currentTime,
    (object) =>
      annotations.handleAnnotationObjectsChange(
        [...objects, { ...object, target }],
        target,
      ),
  );
  const onTargetChange = (value: AnnotationTarget): void => {
    if (value === 'secondary' && !currentItemState.currentVideoSource2) return;
    seek(core.currentTime);
    core.setDrawingTarget(value);
    core.setViewMode(value === 'primary' ? 'angle1' : 'angle2');
  };
  return {
    active,
    pitch,
    contentRect,
    timeline: {
      keyframes: editor.keyframes,
      objects,
      time: core.currentTime,
      min: currentItemState.sliderMin,
      max: currentItemState.sliderMax,
      selectedId: editor.inspector.selectedId,
      onSelect: editor.inspector.onSelect,
      onSeek: seek,
    },
    coachMode,
    coach: {
      tools: presets.preferences.coachTools,
      colors: presets.preferences.coachColors,
      editor: editor.inspector,
      onClearFrame: () => {
        if (!editor.inspector.enabled) return;
        annotations.handleAnnotationObjectsChange(
          objects.filter(
            (object) => Math.abs(object.timestamp - core.currentTime) > 0.12,
          ),
          target,
        );
      },
    },
    canvas: {
      ...editor.canvas,
      trackingTarget: tracking.targetSelection
        ? { selection: tracking.targetSelection, contentRect }
        : undefined,
      enabled: editor.canvas.enabled && !pitch.editing,
    },
    sidebar: {
      panel,
      onPanelChange: setPanel,
      ...editor.inspector,
      renderError: editor.inspector.renderError || grassError,
      tracking,
      pitch,
      chroma,
      presets,
      target,
      hasSecondary: Boolean(currentItemState.currentVideoSource2),
      onTargetChange,
    },
    transport: {
      coachMode,
      onCoachModeChange: setCoachMode,
      time: core.currentTime,
      min: currentItemState.sliderMin,
      max: currentItemState.sliderMax,
      playing: core.isPlaying || core.isFrozen,
      disabled: !item || !currentItemState.currentVideoSource,
      freezeDuration: annotations.currentAnnotation?.freezeDuration ?? 3,
      onFreezeDurationChange: annotations.handleFreezeDurationChange,
      onSeek: seek,
      onTogglePlay: togglePlayback,
    },
    clips: {
      items: history.items,
      currentIndex: core.currentIndex,
      onSelect: selectClip,
    },
    onModeChange: (mode): void => {
      if (mode === core.workspaceMode) return;
      if (core.isDrawingMode) runtime.handleToggleDrawingMode();
      if (mode === 'studio') {
        previousView.current = core.viewMode;
        seek(core.currentTime);
        core.setViewMode('angle1');
        core.setDrawingTarget('primary');
        if (!item && history.items[0]) selectClip(history.items[0].id);
      } else if (active) {
        seek(core.currentTime);
        core.setViewMode(previousView.current);
      }
      core.setWorkspaceMode(mode);
    },
  };
};
