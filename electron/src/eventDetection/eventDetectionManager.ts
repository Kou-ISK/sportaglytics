import type {
  EventDetectionModelInfo,
  EventDetectionProgress,
  EventDetectionRequest,
  EventDetectionResult,
} from '../../../src/types/eventDetection/core';
import {
  findEventDetectionModel,
  listEventDetectionModels as listRunnableEventDetectionModels,
} from './modelDiscovery';
import { runEventDetectionProcess } from './processRunner';
import { cancelEventDetectionProcess } from './requestRegistry';
import { validateEventDetectionClips } from './inputValidation';
import {
  eventDetectionCacheKey,
  EventDetectionResultCache,
} from './resultCache';

const resultCache = new EventDetectionResultCache();

export const listEventDetectionModels = async (): Promise<
  EventDetectionModelInfo[]
> => {
  const models = await listRunnableEventDetectionModels();
  return models.map((model) => model.info);
};

export const cancelEventDetection = (requestId: string): boolean => {
  return cancelEventDetectionProcess(requestId);
};

export const runEventDetection = async (
  request: EventDetectionRequest,
  options?: { onProgress?: (progress: EventDetectionProgress) => void },
): Promise<EventDetectionResult> => {
  const model = await findEventDetectionModel(
    request.modelId,
    request.modelVersion,
  );
  if (!model) {
    throw new Error('利用可能な自動イベント検出モデルが見つかりません。');
  }

  const supportedEvents = new Set(model.info.events);
  if (request.events.some((eventType) => !supportedEvents.has(eventType))) {
    throw new Error('選択したモデルが対応していないイベントが含まれています。');
  }

  await validateEventDetectionClips(request.clips);
  const key = await eventDetectionCacheKey(model, request);
  const cached = resultCache.get(key, request.requestId);
  if (cached) {
    options?.onProgress?.({
      requestId: request.requestId,
      stage: 'finalizing',
      progress: 1,
      message: '保存済みの解析結果を再利用しました。',
    });
    return cached;
  }
  const result = await runEventDetectionProcess({
    model,
    request,
    onProgress: options?.onProgress,
  });
  // An external video/model edit during inference must not create a stale hit.
  if (key && key === (await eventDetectionCacheKey(model, request))) {
    resultCache.set(key, result);
  }
  return result;
};
