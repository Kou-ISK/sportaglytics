import type { TacticalBoard } from '../../../../types/playlist/tacticalBoard';
import type { ChromaKey } from '../../../../shared/tactics/chromaKey';
import { useCallback, useMemo } from 'react';
import type {
  AnnotationTarget,
  DrawingObject,
  ItemAnnotation,
  PlaylistItem,
  PitchCalibration,
} from '../../../../types/playlist/core';

interface UsePlaylistAnnotationsParams {
  currentItem: PlaylistItem | null;
  itemAnnotations: Record<string, ItemAnnotation>;
  setItemAnnotations: React.Dispatch<
    React.SetStateAction<Record<string, ItemAnnotation>>
  >;
  setItemsWithHistory: React.Dispatch<React.SetStateAction<PlaylistItem[]>>;
  setHasUnsavedChanges: React.Dispatch<React.SetStateAction<boolean>>;
  minFreezeDuration: number;
  defaultFreezeDuration: number;
}

interface UsePlaylistAnnotationsResult {
  currentAnnotation: ItemAnnotation | null;
  handleTacticalBoardChange: (
    board: TacticalBoard,
    target: AnnotationTarget,
  ) => void;
  handleChromaKeyChange: (
    key: ChromaKey | undefined,
    target: AnnotationTarget,
  ) => void;
  handlePitchCalibrationChange: (
    calibration: PitchCalibration | undefined,
    target: AnnotationTarget,
  ) => void;
  handleAnnotationObjectsChange: (
    objects: DrawingObject[],
    target?: AnnotationTarget,
    grassKey?: ChromaKey,
  ) => void;
  handleFreezeDurationChange: (freezeDuration: number) => void;
}

export const usePlaylistAnnotations = ({
  currentItem,
  itemAnnotations,
  setItemAnnotations,
  setItemsWithHistory,
  setHasUnsavedChanges,
  minFreezeDuration,
  defaultFreezeDuration,
}: UsePlaylistAnnotationsParams): UsePlaylistAnnotationsResult => {
  const currentAnnotation = useMemo(() => {
    if (!currentItem) return null;
    const base =
      itemAnnotations[currentItem.id] || currentItem.annotation || null;
    const normalized = base
      ? {
          ...base,
          objects: base.objects || [],
          freezeAt: base.freezeAt ?? 0,
          freezeDuration:
            base.freezeDuration === undefined || base.freezeDuration === 0
              ? defaultFreezeDuration
              : base.freezeDuration,
        }
      : {
          objects: [],
          freezeDuration: defaultFreezeDuration,
          freezeAt: 0,
        };

    const isEmbedded = currentItem.videoSource?.startsWith('./videos/');
    if (!isEmbedded || currentItem.startTime === undefined) {
      return normalized;
    }

    return {
      ...normalized,
      objects: normalized.objects.map((obj) => ({
        ...obj,
        timestamp: obj.timestamp + currentItem.startTime,
      })),
    };
  }, [currentItem, defaultFreezeDuration, itemAnnotations]);

  const handleAnnotationObjectsChange = useCallback(
    (
      objects: DrawingObject[],
      target: AnnotationTarget = 'primary',
      grassKey?: ChromaKey,
    ) => {
      if (!currentItem) return;
      const currentAnn = itemAnnotations[currentItem.id] ||
        currentItem.annotation || {
          objects: [],
          freezeDuration: defaultFreezeDuration,
          freezeAt: 0,
        };

      const normalizedObjects = objects.map((obj) => {
        let adjustedTimestamp = obj.timestamp;

        const isEmbedded = currentItem.videoSource?.startsWith('./videos/');
        if (isEmbedded && currentItem.startTime !== undefined) {
          adjustedTimestamp = obj.timestamp - currentItem.startTime;
        }

        return {
          ...obj,
          timestamp: adjustedTimestamp,
          target: obj.target || target,
        };
      });

      const otherObjects = currentAnn.objects.filter(
        (obj) => (obj.target || 'primary') !== target,
      );
      const mergedObjects = [...normalizedObjects, ...otherObjects];
      const newAnnotation: ItemAnnotation = {
        ...currentAnn,
        objects: mergedObjects,
        ...(grassKey
          ? { chromaKey: { ...currentAnn.chromaKey, [target]: grassKey } }
          : {}),
        freezeDuration: Math.max(
          minFreezeDuration,
          currentAnn.freezeDuration ?? defaultFreezeDuration,
        ),
      };
      setItemAnnotations((prev) => ({
        ...prev,
        [currentItem.id]: newAnnotation,
      }));
      setItemsWithHistory((prev) =>
        prev.map((item) =>
          item.id === currentItem.id
            ? { ...item, annotation: newAnnotation }
            : item,
        ),
      );
      setHasUnsavedChanges(true);
    },
    [
      currentItem,
      defaultFreezeDuration,
      itemAnnotations,
      minFreezeDuration,
      setHasUnsavedChanges,
      setItemAnnotations,
      setItemsWithHistory,
    ],
  );

  const handleFreezeDurationChange = useCallback(
    (freezeDuration: number) => {
      if (!currentItem) return;
      const currentAnn = itemAnnotations[currentItem.id] ||
        currentItem.annotation || {
          objects: [],
          freezeDuration: defaultFreezeDuration,
          freezeAt: 0,
        };
      const effectiveDuration =
        freezeDuration > 0
          ? Math.max(minFreezeDuration, freezeDuration)
          : defaultFreezeDuration;
      const newAnnotation = {
        ...currentAnn,
        freezeDuration: effectiveDuration,
      };
      setItemAnnotations((prev) => ({
        ...prev,
        [currentItem.id]: newAnnotation,
      }));
      setItemsWithHistory((prev) =>
        prev.map((item) =>
          item.id === currentItem.id
            ? { ...item, annotation: newAnnotation }
            : item,
        ),
      );
      setHasUnsavedChanges(true);
    },
    [
      currentItem,
      defaultFreezeDuration,
      itemAnnotations,
      minFreezeDuration,
      setHasUnsavedChanges,
      setItemAnnotations,
      setItemsWithHistory,
    ],
  );

  const commitAnnotation = (patch: Partial<ItemAnnotation>): void => {
    if (!currentItem) return;
    const currentAnn = itemAnnotations[currentItem.id] ||
      currentItem.annotation || {
        objects: [],
        freezeDuration: defaultFreezeDuration,
        freezeAt: 0,
      };
    const annotation = { ...currentAnn, ...patch };
    setItemAnnotations((previous) => ({
      ...previous,
      [currentItem.id]: annotation,
    }));
    setItemsWithHistory((previous) =>
      previous.map((item) =>
        item.id === currentItem.id ? { ...item, annotation } : item,
      ),
    );
    setHasUnsavedChanges(true);
  };
  const handlePitchCalibrationChange = (
    calibration: PitchCalibration | undefined,
    target: AnnotationTarget,
  ): void => {
    commitAnnotation({
      pitchCalibration: {
        ...currentAnnotation?.pitchCalibration,
        [target]: calibration,
      },
    });
  };
  const handleChromaKeyChange = (
    key: ChromaKey | undefined,
    target: AnnotationTarget,
  ): void => {
    commitAnnotation({
      chromaKey: { ...currentAnnotation?.chromaKey, [target]: key },
    });
  };
  const handleTacticalBoardChange = (
    board: TacticalBoard,
    target: AnnotationTarget,
  ): void => {
    commitAnnotation({
      tacticalBoard: { ...currentAnnotation?.tacticalBoard, [target]: board },
    });
  };

  return {
    currentAnnotation,
    handleChromaKeyChange,
    handlePitchCalibrationChange,
    handleTacticalBoardChange,
    handleAnnotationObjectsChange,
    handleFreezeDurationChange,
  };
};
