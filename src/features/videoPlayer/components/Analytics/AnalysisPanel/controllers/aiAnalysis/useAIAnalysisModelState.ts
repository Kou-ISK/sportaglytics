import { useEffect, useMemo, useState } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
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

export const useAIAnalysisModelState = ({
  model,
  generationRunIdRef,
  setLlmProgress,
  setLlmLiveLog,
}: UseAIAnalysisModelStateParams): AIAnalysisModelState => {
  const [availableModels, setAvailableModels] = useState<AvailableModelInfo[]>([]);
  const [modelsStatus, setModelsStatus] = useState<'idle' | 'loading' | 'done' | 'error'>(
    'idle',
  );
  const [modelsError, setModelsError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const loadModels = async () => {
      const llamaApi = globalThis.window?.electronAPI?.llama;
      if (!llamaApi?.listModels) {
        return;
      }
      setModelsStatus('loading');
      setModelsError(null);
      try {
        const models = await llamaApi.listModels();
        if (!mounted) return;
        const sorted = [...(models ?? [])].sort((a, b) => b.sizeBytes - a.sizeBytes);
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
    const llamaApi = globalThis.window?.electronAPI?.llama;
    if (!llamaApi?.onProgress) return;

    const handleProgress = (payload: unknown) => {
      if (!payload || typeof payload !== 'object') return;
      const data = payload as {
        requestId?: string;
        phase?: string;
        outputChars?: number;
        elapsedMs?: number;
        stderrChunk?: string;
      };
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

    llamaApi.onProgress(handleProgress);
    return () => {
      llamaApi.offProgress?.(handleProgress);
    };
  }, [generationRunIdRef, setLlmLiveLog, setLlmProgress]);

  const recommendedModel = useMemo(() => {
    if (availableModels.length === 0) return null;
    return availableModels[0];
  }, [availableModels]);

  const isAutoModel = model.trim().toLowerCase() === 'auto';

  const modelSummary = useMemo(() => {
    if (isAutoModel) {
      return recommendedModel ? `auto (推奨: ${recommendedModel.name})` : 'auto';
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
