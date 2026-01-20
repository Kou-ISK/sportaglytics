import { useCallback, useMemo } from 'react';
import type {
  AnnotationTarget,
  DrawingObject,
  ItemAnnotation,
  PlaylistItem,
} from '../../../types/Playlist';
import type { AnnotationCanvasRef } from '../components/AnnotationCanvas';

interface UsePlaylistAnnotationsParams {
  currentItem: PlaylistItem | null;
  itemAnnotations: Record<string, ItemAnnotation>;
  setItemAnnotations: React.Dispatch<
    React.SetStateAction<Record<string, ItemAnnotation>>
  >;
  setItemsWithHistory: React.Dispatch<
    React.SetStateAction<PlaylistItem[]>
  >;
  setHasUnsavedChanges: React.Dispatch<React.SetStateAction<boolean>>;
  minFreezeDuration: number;
  defaultFreezeDuration: number;
}

interface UsePlaylistAnnotationsResult {
  currentAnnotation: ItemAnnotation | null;
  persistCanvasObjects: (
    ref: React.RefObject<AnnotationCanvasRef | null>,
    target: AnnotationTarget,
  ) => void;
  handleAnnotationObjectsChange: (
    objects: DrawingObject[],
    target?: AnnotationTarget,
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
    if (base) {
      return {
        ...base,
        objects: base.objects || [],
        freezeAt: base.freezeAt ?? 0,
        freezeDuration:
          base.freezeDuration === undefined || base.freezeDuration === 0
            ? defaultFreezeDuration
            : base.freezeDuration,
      };
    }
    return {
      objects: [],
      freezeDuration: defaultFreezeDuration,
      freezeAt: 0,
    };
  }, [currentItem, defaultFreezeDuration, itemAnnotations]);

  const persistCanvasObjects = useCallback(
    (
      ref: React.RefObject<AnnotationCanvasRef | null>,
      target: AnnotationTarget,
    ) => {
      if (!currentItem || !ref.current) return;
      const objects = ref.current.getObjects();
      const currentAnn = itemAnnotations[currentItem.id] || {
        objects: [],
        freezeDuration: defaultFreezeDuration,
        freezeAt: 0,
      };
      const normalized = objects.map((obj) => ({
        ...obj,
        target: obj.target || target,
      }));
      const otherObjects = currentAnn.objects.filter(
        (obj) => (obj.target || 'primary') !== target,
      );
      const mergedObjects = [...normalized, ...otherObjects];
      const newAnnotation = {
        ...currentAnn,
        objects: mergedObjects,
        freezeDuration: currentAnn.freezeDuration ?? defaultFreezeDuration,
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
      setHasUnsavedChanges,
      setItemAnnotations,
      setItemsWithHistory,
    ],
  );

  const handleAnnotationObjectsChange = useCallback(
    (objects: DrawingObject[], target: AnnotationTarget = 'primary') => {
      if (!currentItem) return;
      const currentAnn = itemAnnotations[currentItem.id] || {
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
      const currentAnn = itemAnnotations[currentItem.id] || {
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

  return {
    currentAnnotation,
    persistCanvasObjects,
    handleAnnotationObjectsChange,
    handleFreezeDurationChange,
  };
};
