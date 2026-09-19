// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EventDetectionModelInfo } from '../../../../types/eventDetection/core';
import * as gateway from '../gateway/eventDetectionGateway';
import { useEventDetectionController } from './useEventDetectionController';

vi.mock('../gateway/eventDetectionGateway', () => ({
  listEventDetectionModels: vi.fn(),
  runEventDetection: vi.fn(),
  cancelEventDetection: vi.fn(),
  subscribeEventDetectionOpenRequest: vi.fn(),
  subscribeEventDetectionProgress: vi.fn(),
}));

const model: EventDetectionModelInfo = {
  id: 'test',
  version: '1',
  displayName: 'Test',
  status: 'experimental',
  evaluationBasis: 'reported-metrics',
  events: ['lineout'],
  metrics: {
    lineout: {
      precision: 1,
      recall: 1,
      evaluatedMatches: 1,
      confidenceThreshold: 0.5,
    },
  },
};
type Params = Parameters<typeof useEventDetectionController>[0];
const createParams = (): Params => ({
  mediaAngles: [
    {
      id: 'angle-1',
      name: 'Angle 1',
      sourceKind: 'local',
      clips: [
        {
          id: 'clip-1',
          sourceKind: 'local',
          source: '/match.stpkg/clip.mp4',
          gapBeforeSeconds: 0,
          timelineStartSeconds: 0,
          durationSeconds: 10,
        },
      ],
    },
  ],
  activeCodeWindow: {
    id: 'code-window',
    name: 'Code',
    canvasWidth: 400,
    canvasHeight: 300,
    buttons: [],
  },
  timeline: [],
  maxTime: 10,
  addTimelineDatas: vi.fn(() => ['event-1']),
});
const openDialog = (): void => {
  const subscription = vi.mocked(gateway.subscribeEventDetectionOpenRequest)
    .mock.lastCall;
  if (!subscription) throw new Error('Open listener is missing');
  subscription[0]();
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(gateway.subscribeEventDetectionOpenRequest).mockReturnValue(
    vi.fn(),
  );
  vi.mocked(gateway.subscribeEventDetectionProgress).mockReturnValue(vi.fn());
  vi.mocked(gateway.listEventDetectionModels).mockResolvedValue([model]);
  vi.mocked(gateway.runEventDetection).mockImplementation(async (request) => ({
    requestId: request.requestId,
    modelId: model.id,
    modelVersion: model.version,
    durationMs: 1,
    candidates: [
      {
        id: 'candidate',
        clipId: 'clip-1',
        eventType: 'lineout',
        confidence: 0.99,
        anchorTime: 5,
      },
    ],
  }));
});
afterEach(cleanup);

describe('event detection dialog lifecycle', () => {
  it('keeps the loaded form and edits during media and code-window updates', async () => {
    const params = createParams();
    const { result, rerender } = renderHook(useEventDetectionController, {
      initialProps: params,
    });
    await act(async () => openDialog());
    await waitFor(() =>
      expect(result.current.viewProps.loadingModels).toBe(false),
    );
    act(() =>
      result.current.viewProps.onMappingChange('lineout', {
        actionName: 'Review Lineout',
        minConfidence: 0.7,
      }),
    );
    // Metadata and runtime coding state can publish new object identities while open.
    rerender({
      ...params,
      ...createParams(),
      addTimelineDatas: params.addTimelineDatas,
    });
    await act(async () => {});
    expect(gateway.listEventDetectionModels).toHaveBeenCalledTimes(1);
    expect(result.current.viewProps.loadingModels).toBe(false);
    expect(result.current.viewProps.mappings[0]).toMatchObject({
      actionName: 'Review Lineout',
      minConfidence: 0.7,
    });
    await act(async () => result.current.viewProps.onRun());
    expect(params.addTimelineDatas).toHaveBeenCalledWith([
      expect.objectContaining({ actionName: 'Review Lineout' }),
    ]);
    expect(result.current.viewProps.summary?.added).toBe(1);
  });

  it('loads once per opening and ignores a response from a closed dialog', async () => {
    let finish: ((models: EventDetectionModelInfo[]) => void) | undefined;
    vi.mocked(gateway.listEventDetectionModels).mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { result } = renderHook(useEventDetectionController, {
      initialProps: createParams(),
    });
    act(() => openDialog());
    expect(result.current.viewProps.loadingModels).toBe(true);
    act(() => result.current.viewProps.onClose());
    await act(async () => finish?.([model]));
    expect(result.current.viewProps.open).toBe(false);
    expect(result.current.viewProps.models).toEqual([]);
    await act(async () => openDialog());
    expect(gateway.listEventDetectionModels).toHaveBeenCalledTimes(2);
    expect(result.current.viewProps.models).toEqual([model]);
  });

  it('updates a removed angle without reloading models or resetting mappings', async () => {
    const params = createParams();
    const { result, rerender } = renderHook(useEventDetectionController, {
      initialProps: params,
    });
    await act(async () => openDialog());
    act(() =>
      result.current.viewProps.onMappingChange('lineout', {
        minConfidence: 0.8,
      }),
    );
    rerender({
      ...params,
      mediaAngles: params.mediaAngles.map((angle) => ({
        ...angle,
        id: 'angle-2',
      })),
    });
    await act(async () => {});
    expect(result.current.viewProps.selectedAngleId).toBe('angle-2');
    expect(result.current.viewProps.mappings[0].minConfidence).toBe(0.8);
    expect(gateway.listEventDetectionModels).toHaveBeenCalledTimes(1);
  });
});

it('uses current Timeline edits when a background run completes', async () => {
  const params = createParams();
  const implementation = vi
    .mocked(gateway.runEventDetection)
    .getMockImplementation();
  if (!implementation) throw new Error('Missing runner');
  let finish: (() => void) | undefined;
  vi.mocked(gateway.runEventDetection).mockImplementation(async (request) => {
    await new Promise<void>((resolve) => {
      finish = resolve;
    });
    return implementation(request);
  });
  const { result, rerender } = renderHook(useEventDetectionController, {
    initialProps: params,
  });
  await act(async () => openDialog());
  act(() => result.current.viewProps.onRun());
  rerender({
    ...params,
    timeline: [
      {
        id: 'manual',
        actionName: 'Lineout',
        startTime: 0,
        endTime: 10,
        memo: '',
      },
    ],
  });
  await act(async () => finish?.());
  expect(params.addTimelineDatas).toHaveBeenCalledWith([]);
  expect(result.current.viewProps.summary?.duplicates).toBe(1);
  await act(async () => openDialog());
  expect(result.current.viewProps.summary?.duplicates).toBe(1);
  expect(gateway.listEventDetectionModels).toHaveBeenCalledTimes(1);
});

it('cancels and ignores an old run after the source changes or its owner unmounts', async () => {
  const params = createParams();
  const implementation = vi
    .mocked(gateway.runEventDetection)
    .getMockImplementation();
  if (!implementation) throw new Error('Missing runner');
  let finish: (() => void) | undefined;
  vi.mocked(gateway.runEventDetection).mockImplementation(async (request) => {
    await new Promise<void>((resolve) => {
      finish = resolve;
    });
    return implementation(request);
  });
  const { result, rerender, unmount } = renderHook(
    useEventDetectionController,
    { initialProps: params },
  );
  await act(async () => openDialog());
  act(() => result.current.viewProps.onRun());
  rerender({ ...params, mediaAngles: [] });
  expect(gateway.cancelEventDetection).toHaveBeenCalledTimes(1);
  await act(async () => finish?.());
  expect(params.addTimelineDatas).not.toHaveBeenCalled();
  rerender(params);
  await act(async () => {});
  act(() => result.current.viewProps.onRun());
  unmount();
  expect(gateway.cancelEventDetection).toHaveBeenCalledTimes(2);
  await act(async () => finish?.());
  expect(params.addTimelineDatas).not.toHaveBeenCalled();
});
