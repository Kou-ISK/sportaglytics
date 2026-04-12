import { useEffect, useMemo, useState } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import {
  canListLocalLlmModels,
  canSubscribeLocalLlmProgress,
  listLocalLlmModels,
  subscribeLocalLlmProgress,
} from '../../../../../analysis/ai/llmGateway';
import type { AvailableModelInfo } from './aiAnalysisUtils';

interface LlmProgressState {
  requestId: string;
  phase?: string;
  outputChars?: number;
  elapsedMs?: number;
}

interface UseAIAnalysisModelStateParams {
  model: string;
  generationRunIdRef: MutableRefObject<string | null>;
  setLlmProgress: Dispatch<SetStateAction<LlmProgressState | null>>;
  setLlmLiveLog: Dispatch<SetStateAction<string>>;
}

interface AIAnalysisModelState {
  availableModels: AvailableModelInfo[];
  modelsStatus: 'idle' | 'loading' | 'done' | 'error';
  modelsError: string | null;
  recommendedModel: AvailableModelInfo | null;
  isAutoModel: boolean;
  modelSummary: string;
}

const isOptionalString = (value: unknown): boolean => {
  return value === undefined || typeof value === 'string';
};

const isOptionalNumber = (value: unknown): boolean => {
  return value === undefined || typeof value === 'number';
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const isLlmProgressPayload = (
  payload: unknown,
): payload is LlmProgressState & { stderrChunk?: string } => {
  return (
    isRecord(payload) &&
    typeof payload.requestId === 'string' &&
    isOptionalString(payload.phase) &&
    isOptionalNumber(payload.outputChars) &&
    isOptionalNumber(payload.elapsedMs) &&
    isOptionalString(payload.stderrChunk)
  );
};

export const useAIAnalysisModelState = ({
  model,
  generationRunIdRef,
  setLlmProgress,
  setLlmLiveLog,
}: UseAIAnalysisModelStateParams): AIAnalysisModelState => {
  const [availableModels, setAvailableModels] = useState<AvailableModelInfo[]>(
    [],
  );
  const [modelsStatus, setModelsStatus] = useState<
    'idle' | 'loading' | 'done' | 'error'
  >('idle');
  const [modelsError, setModelsError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const loadModels = async () => {
      if (!canListLocalLlmModels()) {
        return;
      }
      setModelsStatus('loading');
      setModelsError(null);
      try {
        const models = await listLocalLlmModels();
        if (!mounted) return;
        const sorted = [...(models ?? [])].sort(
          (a, b) => b.sizeBytes - a.sizeBytes,
        );
        setAvailableModels(sorted);
        setModelsStatus('done');
      } catch (error) {
        if (!mounted) return;
        console.debug('[AI] model list failed', error);
        setModelsError('モデル一覧の取得に失敗しました。');
        setModelsStatus('error');
      }
    };
    void loadModels();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!canSubscribeLocalLlmProgress()) return;

    const handleProgress = (payload: unknown) => {
      if (!isLlmProgressPayload(payload)) return;
      const data = payload;
      if (!data.requestId || data.requestId !== generationRunIdRef.current) {
        return;
      }
      setLlmProgress({
        requestId: data.requestId,
        phase: data.phase,
        outputChars: data.outputChars,
        elapsedMs: data.elapsedMs,
      });
      if (data.stderrChunk) {
        setLlmLiveLog((prev) => {
          const next = `${prev}${data.stderrChunk}`;
          if (next.length <= 8000) return next;
          return next.slice(-8000);
        });
      }
    };

    return subscribeLocalLlmProgress(handleProgress);
  }, [generationRunIdRef, setLlmLiveLog, setLlmProgress]);

  const recommendedModel = useMemo(() => {
    if (availableModels.length === 0) return null;
    return availableModels[0];
  }, [availableModels]);

  const isAutoModel = model.trim().toLowerCase() === 'auto';

  const modelSummary = useMemo(() => {
    if (isAutoModel) {
      return recommendedModel
        ? `auto (推奨: ${recommendedModel.name})`
        : 'auto';
    }
    return model;
  }, [isAutoModel, model, recommendedModel]);

  return {
    availableModels,
    modelsStatus,
    modelsError,
    recommendedModel,
    isAutoModel,
    modelSummary,
  };
};
