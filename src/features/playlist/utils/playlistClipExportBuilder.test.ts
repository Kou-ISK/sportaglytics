import { describe, expect, it, vi } from 'vitest';
import type { PlaylistItem } from '../../../types/playlist/core';
import { buildPlaylistExportClips } from './playlistClipExportBuilder';

const sampleItems: PlaylistItem[] = [
  {
    id: 'item-1',
    timelineItemId: 'timeline-1',
    actionName: 'Try',
    startTime: 10,
    endTime: 14,
    labels: [{ group: 'Result', name: 'Positive' }],
    memo: 'first memo',
    addedAt: 1,
    annotation: {
      objects: [
        {
          id: 'draw-1',
          type: 'circle',
          color: '#fff',
          strokeWidth: 2,
          startX: 0,
          startY: 0,
          timestamp: 11,
        },
      ],
      freezeDuration: 3,
      freezeAt: 0,
    },
    videoSource: 'main.mp4',
    videoSource2: 'sub.mp4',
  },
  {
    id: 'item-2',
    timelineItemId: 'timeline-2',
    actionName: 'Try',
    startTime: 20,
    endTime: 24,
    addedAt: 2,
  },
];

describe('playlistClipExportBuilder', () => {
  it('builds playlist export clips with action indexes and annotation overlays', () => {
    const renderAnnotationPng = vi
      .fn()
      .mockReturnValueOnce('data:image/png;base64,primary')
      .mockReturnValueOnce('data:image/png;base64,secondary')
      .mockReturnValue(null);

    const clips = buildPlaylistExportClips({
      sourceItems: sampleItems,
      itemAnnotations: {},
      minFreezeDuration: 2,
      primaryContentRect: { width: 100, height: 50, offsetX: 0, offsetY: 0 },
      secondaryContentRect: { width: 100, height: 50, offsetX: 0, offsetY: 0 },
      primarySourceSize: { width: 1920, height: 1080 },
      secondarySourceSize: { width: 1280, height: 720 },
      renderAnnotationPng,
    });

    expect(clips).toHaveLength(2);
    expect(clips[0]).toMatchObject({
      id: 'item-1',
      actionIndex: 1,
      freezeAt: 1,
      freezeDuration: 3,
      annotationPngPrimary: 'data:image/png;base64,primary',
      annotationPngSecondary: 'data:image/png;base64,secondary',
      videoSource: 'main.mp4',
      videoSource2: 'sub.mp4',
    });
    expect(clips[1]).toMatchObject({
      id: 'item-2',
      actionIndex: 2,
      freezeAt: null,
      freezeDuration: 2,
    });
  });
});
