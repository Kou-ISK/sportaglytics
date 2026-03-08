import { useMemo } from 'react';
import type { AIAnalysisSettings } from '../../../../../../../../types/Settings';
import {
  resolveDiversifyTarget,
  RETRIEVER_WEIGHT_MAP,
} from './aiAnalysisUtils';

export const useAIAnalysisRetrieverConfig = (
  aiSettings: AIAnalysisSettings,
) => {
  const retrieverPreset = aiSettings.retrieverPreset ?? 'balanced';
  const retrieverWeights = useMemo(() => {
    return RETRIEVER_WEIGHT_MAP[retrieverPreset] ?? RETRIEVER_WEIGHT_MAP.balanced;
  }, [retrieverPreset]);
  const topK = Math.max(1, aiSettings.topK || 40);
  const evidenceTarget = useMemo(() => resolveDiversifyTarget(topK), [topK]);

  return {
    retrieverPreset,
    retrieverWeights,
    topK,
    evidenceTarget,
  };
};
