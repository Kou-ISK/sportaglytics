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
    note: 'first note\nsecond line',
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
      memo: 'first note\nsecond line',
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

it('exports distinct Studio frames in timestamp order and handles embedded offsets', () => {
  const first = sampleItems[0];
  const object = first.annotation!.objects[0];
  const render = vi.fn((objects) =>
    JSON.stringify(objects?.map((entry: { id: string }) => entry.id)),
  );
  const build = (videoSource: string, times: number[]) =>
    buildPlaylistExportClips({
      sourceItems: [
        {
          ...first,
          videoSource,
          annotation: {
            ...first.annotation!,
            objects: times.map((timestamp, index) => ({
              ...object,
              id: `frame-${index}`,
              timestamp,
            })),
          },
        },
      ],
      itemAnnotations: {},
      minFreezeDuration: 2,
      primaryContentRect: { width: 800, height: 450, offsetX: 0, offsetY: 0 },
      secondaryContentRect: { width: 800, height: 450, offsetX: 0, offsetY: 0 },
      primarySourceSize: { width: 1920, height: 1080 },
      secondarySourceSize: { width: 1920, height: 1080 },
      renderAnnotationPng: render,
    })[0];
  const reference = build('match.mp4', [13, 11, 11.05]);
  expect(reference.freezeFrames?.map((frame) => frame.time)).toEqual([1, 3]);
  expect(reference.freezeFrames?.[0].annotationPngPrimary).toBe(
    '["frame-1","frame-2"]',
  );
  expect(reference.freezeFrames?.[1].annotationPngPrimary).toBe('["frame-0"]');
  expect(build('./videos/clip.mp4', [3, 1, 1.05]).freezeFrames).toEqual(
    reference.freezeFrames,
  );
});

it('keeps moving/still layer order and keyframe offsets across embedded/reference exports', () => {
  const first = sampleItems[0];
  const base = first.annotation!.objects[0];
  const create = (embedded: boolean) =>
    buildPlaylistExportClips({
      sourceItems: [
        {
          ...first,
          videoSource: embedded ? './videos/clip.mp4' : 'match.mp4',
          annotation: {
            ...first.annotation!,
            objects: [
              { ...base, timestamp: embedded ? 1 : 11 },
              {
                ...base,
                id: 'moving',
                timestamp: embedded ? 0 : 10,
                baseWidth: 800,
                baseHeight: 450,
                motion: {
                  duration: 4,
                  keyframes: [
                    { time: 0, x: 0, y: 0 },
                    { time: 4, x: 80, y: 20 },
                  ],
                },
              },
            ],
          },
        },
      ],
      itemAnnotations: {},
      minFreezeDuration: 2,
      primaryContentRect: { width: 800, height: 450, offsetX: 0, offsetY: 0 },
      secondaryContentRect: { width: 800, height: 450, offsetX: 0, offsetY: 0 },
      primarySourceSize: { width: 1600, height: 900 },
      secondarySourceSize: { width: 1600, height: 900 },
      renderAnnotationPng: (objects) => objects?.[0].id ?? null,
    })[0];
  const reference = create(false);
  expect(reference.motionOverlays?.map((layer) => layer.png)).toEqual([
    'draw-1',
    'moving',
  ]);
  expect(reference.motionOverlays?.[1].keyframes[1]).toEqual({
    time: 4,
    x: 80,
    y: 20,
  });
  expect(reference.freezeFrames).toEqual([
    {
      time: 1,
      duration: 3,
      annotationPngPrimary: null,
      annotationPngSecondary: null,
    },
  ]);
  expect(create(true).motionOverlays).toEqual(reference.motionOverlays);
});

it('retains a moving object that starts before a trimmed clip, interpolating its initial position', () => {
  const first = sampleItems[0];
  const clip = buildPlaylistExportClips({
    sourceItems: [
      {
        ...first,
        startTime: 12,
        endTime: 14,
        annotation: {
          ...first.annotation!,
          objects: [
            {
              ...first.annotation!.objects[0],
              timestamp: 10,
              motion: {
                duration: 6,
                keyframes: [
                  { time: 0, x: 0, y: 0 },
                  { time: 3, x: 60, y: 30 },
                  { time: 6, x: 0, y: 0 },
                ],
              },
            },
          ],
        },
      },
    ],
    itemAnnotations: {},
    minFreezeDuration: 2,
    primaryContentRect: { width: 100, height: 50, offsetX: 0, offsetY: 0 },
    secondaryContentRect: { width: 100, height: 50, offsetX: 0, offsetY: 0 },
    primarySourceSize: { width: 100, height: 50 },
    secondarySourceSize: { width: 100, height: 50 },
    renderAnnotationPng: () => 'png',
  })[0];
  expect(clip.motionOverlays).toEqual([
    expect.objectContaining({
      start: 0,
      end: 2,
      keyframes: [
        { time: 0, x: 40, y: 20 },
        { time: 1, x: 60, y: 30 },
        { time: 2, x: 40, y: 20 },
      ],
    }),
  ]);
  expect(clip.freezeFrames).toEqual([]);
});

it.each([false, true])(
  'reports a Paint render failure instead of silently exporting without it (motion=%s)',
  (moving) => {
    const first = sampleItems[0];
    expect(() =>
      buildPlaylistExportClips({
        sourceItems: [
          {
            ...first,
            annotation: {
              ...first.annotation!,
              objects: [
                {
                  ...first.annotation!.objects[0],
                  motion: moving
                    ? { duration: 2, keyframes: [{ time: 0, x: 0, y: 0 }] }
                    : undefined,
                },
              ],
            },
          },
        ],
        itemAnnotations: {},
        minFreezeDuration: 2,
        primaryContentRect: { width: 100, height: 50, offsetX: 0, offsetY: 0 },
        secondaryContentRect: {
          width: 100,
          height: 50,
          offsetX: 0,
          offsetY: 0,
        },
        primarySourceSize: { width: 100, height: 50 },
        secondarySourceSize: { width: 100, height: 50 },
        renderAnnotationPng: () => null,
      }),
    ).toThrow('Paintの描画');
  },
);
