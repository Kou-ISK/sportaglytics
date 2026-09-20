import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DrawingObject } from '../../../../types/playlist/core';
import { trackAnnotation } from './trackAnnotation';
const mock = vi.hoisted(() => ({
  read: vi.fn(),
  dispose: vi.fn(),
  match: vi.fn(),
}));
vi.mock('./videoFrameReader', () => ({
  openVideoFrameReader: async () => ({
    width: 320,
    height: 180,
    read: mock.read,
    dispose: mock.dispose,
  }),
}));
vi.mock('./featureTracker', () => ({ trackFeatures: mock.match }));
vi.mock('./trackingAnchor', () => ({
  findTrackingAnchors: (_frame: unknown, center: { x: number; y: number }) => [
    center,
    { x: center.x + 5, y: center.y },
  ],
}));
const object: DrawingObject = {
  id: 'tracked',
  type: 'rectangle',
  startX: 40,
  startY: 60,
  endX: 64,
  endY: 84,
  baseWidth: 320,
  baseHeight: 180,
  timestamp: 10,
  color: '#fff',
  strokeWidth: 2,
  motion: {
    duration: 4,
    keyframes: [
      { time: 0, x: 0, y: 0 },
      { time: 1, x: 20, y: 0 },
      { time: 2, x: 42, y: 3 },
      { time: 4, x: 80, y: 0 },
    ],
  },
};
beforeEach(() => {
  vi.clearAllMocks();
  mock.read.mockResolvedValue({});
  mock.match.mockImplementation(
    (_frame: unknown, _next: unknown, points: { x: number; y: number }[]) => ({
      points: points.map((point) => ({ x: point.x + 2 / 3, y: point.y })),
      dx: 2 / 3,
      dy: 0,
      confidence: 0.99,
      reliable: true,
    }),
  );
});
describe('resumable tracking', () => {
  it('starts at the corrected position and preserves earlier keys', async () => {
    const result = await trackAnnotation(
      'video',
      object,
      14,
      new AbortController().signal,
      () => {},
      12,
    );
    expect(mock.read.mock.calls[0][0]).toBe(12);
    expect(mock.match.mock.calls[0][2][0]).toEqual({ x: 94, y: 75 });
    expect(result.object.motion?.keyframes.slice(0, 3)).toEqual(
      object.motion?.keyframes.slice(0, 3),
    );
    expect(result.object.motion?.keyframes.at(-1)).toEqual({
      time: 4,
      x: expect.closeTo(82, 6),
      y: 3,
    });
    expect(result.trackedDuration).toBe(2);
    expect(result.lost).toBe(false);
    expect(object.motion?.keyframes.at(-1)?.x).toBe(80);
    expect(mock.dispose).toHaveBeenCalledOnce();
  });
  it('does not overwrite the document when no reliable step is available', async () => {
    mock.match.mockReturnValue({
      points: [],
      dx: 0,
      dy: 0,
      confidence: 0.1,
      reliable: false,
    });
    await expect(
      trackAnnotation(
        'video',
        object,
        14,
        new AbortController().signal,
        () => {},
        12,
      ),
    ).rejects.toThrow('追尾に必要な特徴が不足しています');
    expect(mock.dispose).toHaveBeenCalledOnce();
  });
});

it('tracks the explicit player region independently of a distant decorative disc', async () => {
  const disc = {
    ...object,
    type: 'disc' as const,
    startX: 180,
    startY: 150,
    endX: 260,
    endY: 160,
  };
  const result = await trackAnnotation(
    'video',
    disc,
    12.1,
    new AbortController().signal,
    () => {},
    12,
    { minX: 0.1, minY: 0.2, maxX: 0.2, maxY: 0.4 },
  );
  expect(mock.match.mock.calls[0][2][0]).toEqual({ x: 48, y: 54 });
  expect(result.object.startX).toBe(180);
  expect(result.object.endY).toBe(160);
  expect(result.object.motion?.keyframes.at(-1)?.x).toBeGreaterThan(42);
});

it('reads the selected source clock while preserving global annotation timestamps', async () => {
  const result = await trackAnnotation(
    'second-half',
    object,
    14,
    new AbortController().signal,
    () => undefined,
    12,
    undefined,
    -10,
  );
  expect(mock.read.mock.calls[0][0]).toBe(2);
  expect(mock.read.mock.calls.at(-1)?.[0]).toBe(4);
  expect(result.object.timestamp).toBe(10);
  expect(result.object.motion?.keyframes.at(-1)?.time).toBe(4);
});
