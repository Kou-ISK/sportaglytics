import type {
  AnnotationTarget,
  DrawingObject,
  ItemAnnotation,
  PlaylistItem,
} from '../../../types/Playlist';
import type { ClipExportItem } from '../../../shared/clipExport/clipExportTypes';

interface ContentRect {
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
}

interface SourceSize {
  width: number;
  height: number;
}

interface BuildPlaylistExportClipsParams {
  sourceItems: PlaylistItem[];
  itemAnnotations: Record<string, ItemAnnotation>;
  minFreezeDuration: number;
  primaryContentRect: ContentRect;
  secondaryContentRect: ContentRect;
  primarySourceSize: SourceSize;
  secondarySourceSize: SourceSize;
  renderAnnotationPng: (
    objects: DrawingObject[] | undefined,
    target: AnnotationTarget,
    fallbackSize: { width: number; height: number },
    targetSize?: { width: number; height: number },
  ) => string | null;
}

const buildActionIndexLookup = (items: PlaylistItem[]): Map<string, number> => {
  const actionIndexLookup = new Map<string, number>();
  const counters: Record<string, number> = {};

  items.forEach((item) => {
    const count = (counters[item.actionName] || 0) + 1;
    counters[item.actionName] = count;
    actionIndexLookup.set(item.id, count);
  });

  return actionIndexLookup;
};

export const buildPlaylistExportClips = ({
  sourceItems,
  itemAnnotations,
  minFreezeDuration,
  primaryContentRect,
  secondaryContentRect,
  primarySourceSize,
  secondarySourceSize,
  renderAnnotationPng,
}: BuildPlaylistExportClipsParams): ClipExportItem[] => {
  const actionIndexLookup = buildActionIndexLookup(sourceItems);

  return sourceItems.map((item) => {
    const annotation = itemAnnotations[item.id] || item.annotation;
    const allTimestamps =
      annotation?.objects
        ?.map((object) => object.timestamp)
        .filter((timestamp) => timestamp !== undefined) || [];
    const freezeAtAbsolute =
      allTimestamps.length > 0 ? Math.min(...allTimestamps) : null;
    const freezeAt =
      freezeAtAbsolute !== null
        ? Math.max(0, freezeAtAbsolute - item.startTime)
        : null;
    const freezeDuration =
      annotation?.freezeDuration && annotation.freezeDuration > 0
        ? Math.max(minFreezeDuration, annotation.freezeDuration)
        : minFreezeDuration;

    return {
      id: item.id,
      actionName: item.actionName,
      startTime: item.startTime,
      endTime: item.endTime,
      freezeAt,
      freezeDuration,
      labels:
        item.labels?.map((label) => ({
          group: label.group || '',
          name: label.name,
        })) || undefined,
      memo: item.memo || undefined,
      actionIndex: actionIndexLookup.get(item.id) ?? 1,
      annotationPngPrimary: renderAnnotationPng(
        annotation?.objects,
        'primary',
        primaryContentRect,
        primarySourceSize,
      ),
      annotationPngSecondary: renderAnnotationPng(
        annotation?.objects,
        'secondary',
        secondaryContentRect,
        secondarySourceSize,
      ),
      videoSource: item.videoSource || undefined,
      videoSource2: item.videoSource2 || undefined,
    };
  });
};
