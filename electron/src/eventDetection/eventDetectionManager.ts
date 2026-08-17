import type {
  EventDetectionModelInfo,
  EventDetectionProgress,
  EventDetectionRequest,
  EventDetectionResult,
} from '../../../src/types/eventDetection/core';
import {
  findVerifiedEventDetectionModel,
  listVerifiedEventDetectionModels,
} from './modelDiscovery';
import { runEventDetectionProcess } from './processRunner';
import { cancelEventDetectionProcess } from './requestRegistry';

export const listEventDetectionModels = async (): Promise<
  EventDetectionModelInfo[]
> => {
  const models = await listVerifiedEventDetectionModels();
  return models.map((model) => model.info);
};

export const cancelEventDetection = (requestId: string): boolean => {
  return cancelEventDetectionProcess(requestId);
};

export const runEventDetection = async (
  request: EventDetectionRequest,
  options?: { onProgress?: (progress: EventDetectionProgress) => void },
): Promise<EventDetectionResult> => {
  const model = await findVerifiedEventDetectionModel(
    request.modelId,
    request.modelVersion,
  );
  if (!model) {
    throw new Error('検証済みの自動イベント検出モデルが見つかりません。');
  }

  const supportedEvents = new Set(model.info.events);
  if (request.events.some((eventType) => !supportedEvents.has(eventType))) {
    throw new Error('選択したモデルが対応していないイベントが含まれています。');
  }

  return runEventDetectionProcess({
    model,
    request,
    onProgress: options?.onProgress,
  });
};
