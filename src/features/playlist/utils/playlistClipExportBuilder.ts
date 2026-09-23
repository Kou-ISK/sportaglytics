import { buildMotionOverlays } from './playlistMotionExport';
import type {
  AnnotationTarget,
  DrawingObject,
  ItemAnnotation,
  PlaylistItem,
} from '../../../types/playlist/core';
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

export const buildPlaylistTextClips = (
  sourceItems: PlaylistItem[],
): ClipExportItem[] => {
  const indices = buildActionIndexLookup(sourceItems);
  return sourceItems.map((item) => ({
    id: item.id,
    actionName: item.actionName,
    startTime: item.startTime,
    endTime: item.endTime,
    labels: item.labels?.map((label) => ({
      group: label.group || '',
      name: label.name,
    })),
    memo: item.note,
    actionIndex: indices.get(item.id),
    videoSource: item.videoSource,
    videoSource2: item.videoSource2,
    angleType: item.defaultAngle ?? 'angle1',
  }));
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
    const freezeDuration = Math.max(
      minFreezeDuration,
      annotation?.freezeDuration || minFreezeDuration,
    );
    // Embedded annotations are clip-relative; reference annotations use source time.
    const embedded = item.videoSource?.startsWith('./videos/');
    const objects = (annotation?.objects ?? []).filter((object) => {
      const time = embedded
        ? object.timestamp
        : object.timestamp - item.startTime;
      return (
        Number.isFinite(time) &&
        time + (object.motion?.duration ?? 0) >= 0 &&
        time <= item.endTime - item.startTime
      );
    });
    const hasMotion =
      objects.some((object) => object.motion) ||
      Boolean(
        annotation?.chromaKey?.primary || annotation?.chromaKey?.secondary,
      );
    const motionOverlays = hasMotion
      ? buildMotionOverlays(
          objects.map((object) => {
            const rect =
              object.target === 'secondary'
                ? secondaryContentRect
                : primaryContentRect;
            return {
              ...object,
              baseWidth: object.baseWidth ?? rect.width,
              baseHeight: object.baseHeight ?? rect.height,
            };
          }),
          embedded ? 0 : item.startTime,
          item.endTime - item.startTime,
          (entries, target) =>
            renderAnnotationPng(
              entries,
              target,
              target === 'primary' ? primaryContentRect : secondaryContentRect,
              target === 'primary' ? primarySourceSize : secondarySourceSize,
            ),
        )
      : undefined;
    const timestamps = [
      ...new Set(
        objects
          .filter((object) => !object.motion)
          .map((object) => object.timestamp),
      ),
    ].sort((a, b) => a - b);
    // Match playback's frame tolerance, preserving each frame's layer order.
    const frames: number[] = [];
    for (const timestamp of timestamps) {
      if (!frames.some((time) => Math.abs(time - timestamp) <= 0.12))
        frames.push(timestamp);
    }
    const renderFrame = (
      entries: DrawingObject[],
      target: AnnotationTarget,
    ): string | null => {
      const png = renderAnnotationPng(
        entries,
        target,
        target === 'primary' ? primaryContentRect : secondaryContentRect,
        target === 'primary' ? primarySourceSize : secondarySourceSize,
      );
      if (
        !png &&
        entries.some((object) => (object.target ?? 'primary') === target)
      )
        throw new Error(
          'Paintの描画を画像に変換できませんでした。書き出しを再試行してください。',
        );
      return png;
    };
    const freezeFrames = frames.map((timestamp) => {
      const frameObjects = objects.filter(
        (object) => Math.abs(object.timestamp - timestamp) <= 0.12,
      );
      return {
        time: embedded ? timestamp : timestamp - item.startTime,
        duration: freezeDuration,
        annotationPngPrimary: hasMotion
          ? null
          : renderFrame(frameObjects, 'primary'),
        annotationPngSecondary: hasMotion
          ? null
          : renderFrame(frameObjects, 'secondary'),
      };
    });
    return {
      motionOverlays,
      chromaKey: annotation?.chromaKey,
      id: item.id,
      actionName: item.actionName,
      startTime: item.startTime,
      endTime: item.endTime,
      freezeFrames,
      freezeAt: freezeFrames[0]?.time ?? null,
      freezeDuration,
      labels: item.labels?.map((label) => ({
        group: label.group || '',
        name: label.name,
      })),
      memo: item.note || undefined,
      actionIndex: actionIndexLookup.get(item.id) ?? 1,
      annotationPngPrimary: freezeFrames[0]?.annotationPngPrimary ?? null,
      annotationPngSecondary: freezeFrames[0]?.annotationPngSecondary ?? null,
      videoSource: item.videoSource || undefined,
      videoSource2: item.videoSource2 || undefined,
      angleType: item.defaultAngle ?? 'angle1',
    };
  });
};
