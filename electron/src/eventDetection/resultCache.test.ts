import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  EventDetectionRequest,
  EventDetectionResult,
} from '../../../src/types/eventDetection/core';
import type { RunnableEventDetectionModel } from './types';
import {
  eventDetectionCacheKey,
  EventDetectionResultCache,
} from './resultCache';

const result: EventDetectionResult = {
  requestId: 'first',
  modelId: 'model-a',
  modelVersion: '1',
  durationMs: 1234,
  candidates: [
    { id: 'event-a', eventType: 'scrum', confidence: 0.8, anchorTime: 10 },
  ],
};
const directories: string[] = [];
afterEach(async () => {
  vi.useRealTimers();
  await Promise.all(
    directories
      .splice(0)
      .map((folder) => rm(folder, { recursive: true, force: true })),
  );
});

const fixture = async (): Promise<{
  model: RunnableEventDetectionModel;
  request: EventDetectionRequest;
  weights: string;
}> => {
  const root = await mkdtemp(path.join(tmpdir(), 'event-cache-'));
  directories.push(root);
  const modelDirectory = path.join(root, 'model');
  await mkdir(modelDirectory);
  const weights = path.join(modelDirectory, 'checkpoint.pt');
  await writeFile(weights, 'weights');
  const videoPath = path.join(root, 'video.mp4');
  await writeFile(videoPath, 'video');
  return {
    model: {
      modelDirectory,
      runnerPath: path.join(modelDirectory, 'runner'),
      runnerSha256: 'hash-a',
      info: {
        id: 'model-a',
        version: '1',
        displayName: 'Model A',
        status: 'experimental',
        evaluationBasis: 'reference-coding',
        events: ['scrum'],
        metrics: {},
      },
    },
    request: {
      requestId: 'first',
      modelId: 'model-a',
      modelVersion: '1',
      events: ['scrum'],
      clips: [
        {
          clipId: 'clip-a',
          videoPath,
          timelineStartSeconds: 0,
          durationSeconds: 20,
        },
      ],
    },
    weights,
  };
};

describe('event detection result cache', () => {
  it('reuses predictions for a new request without sharing mutable objects or old runtime', () => {
    const cache = new EventDetectionResultCache();
    cache.set('key', result);
    const reused = cache.get('key', 'second');
    expect(reused).toMatchObject({
      requestId: 'second',
      durationMs: 0,
      candidates: result.candidates,
    });
    reused?.candidates.splice(0);
    expect(cache.get('key', 'third')?.candidates).toHaveLength(1);
  });

  it('expires entries and evicts the least recently used within the count and byte budgets', () => {
    vi.useFakeTimers();
    const cache = new EventDetectionResultCache(1024, 2, 1000);
    cache.set('a', result);
    cache.set('b', result);
    cache.get('a', 'read');
    cache.set('c', result);
    expect(cache.get('b', 'miss')).toBeUndefined();
    expect(cache.get('a', 'hit')).toBeDefined();
    vi.advanceTimersByTime(1000);
    expect(cache.get('a', 'expired')).toBeUndefined();
    const small = new EventDetectionResultCache(1);
    small.set('large', result);
    expect(small.get('large', 'miss')).toBeUndefined();
  });

  it('ignores the request id, but invalidates changed timing, events, weights, and video files', async () => {
    const { model, request, weights } = await fixture();
    const initial = await eventDetectionCacheKey(model, request);
    expect(initial).toBeDefined();
    expect(
      await eventDetectionCacheKey(model, { ...request, requestId: 'second' }),
    ).toBe(initial);
    expect(
      await eventDetectionCacheKey(model, { ...request, events: ['lineout'] }),
    ).not.toBe(initial);
    expect(
      await eventDetectionCacheKey(model, {
        ...request,
        clips: [{ ...request.clips[0], timelineStartSeconds: 2 }],
      }),
    ).not.toBe(initial);
    await writeFile(weights, 'different weights');
    const changedModel = await eventDetectionCacheKey(model, request);
    expect(changedModel).not.toBe(initial);
    await writeFile(request.clips[0].videoPath, 'different video');
    expect(await eventDetectionCacheKey(model, request)).not.toBe(changedModel);
  });

  it('does not reuse missing files or symlinked model trees', async () => {
    const { model, request, weights } = await fixture();
    await rm(request.clips[0].videoPath);
    expect(await eventDetectionCacheKey(model, request)).toBeUndefined();
    await writeFile(request.clips[0].videoPath, 'video');
    // File links are not required for ordinary execution, only excluded from caching.
    if (process.platform !== 'win32') {
      await symlink(weights, path.join(model.modelDirectory, 'linked.pt'));
      expect(await eventDetectionCacheKey(model, request)).toBeUndefined();
    }
  });
});
