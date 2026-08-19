import type {
  EventDetectionModelInfo,
  EventDetectionProgress,
  EventDetectionRequest,
  EventDetectionResult,
} from '../../../../types/eventDetection/core';
import { isEventDetectionModelInfoList } from '../../../../types/ipc/eventDetection';

const getApi = () => window.electronAPI?.eventDetection;

export const listEventDetectionModels = async (): Promise<
  EventDetectionModelInfo[]
> => {
  const api = getApi();
  if (!api) return [];
  const models: unknown = await api.listModels();
  if (!isEventDetectionModelInfoList(models)) {
    throw new Error('自動イベント検出モデル情報が不正です。');
  }
  return models;
};

export const runEventDetection = async (
  request: EventDetectionRequest,
): Promise<EventDetectionResult> => {
  const api = getApi();
  if (!api) throw new Error('自動イベント検出APIを利用できません。');
  return api.run(request);
};

export const cancelEventDetection = async (requestId: string): Promise<boolean> => {
  const api = getApi();
  return api ? api.cancel(requestId) : false;
};

export const subscribeEventDetectionProgress = (
  callback: (progress: EventDetectionProgress) => void,
): (() => void) => {
  const api = getApi();
  if (!api) return () => undefined;
  api.onProgress(callback);
  return () => api.offProgress(callback);
};

export const subscribeEventDetectionOpenRequest = (
  callback: () => void,
): (() => void) => {
  const api = getApi();
  return api ? api.onOpenRequested(callback) : () => undefined;
};
