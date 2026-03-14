import {
  useCallback,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react';
import type {
  AiCopilotResponse,
  EvidenceFilters,
  EvidenceItem,
} from '../../../../../analysis/ai';
import type { InsightDimension } from '../../../../../analysis/utils/eventInsights';
import type { TimelineData } from '../../../../../../../types/TimelineData';
import { useAIAnalysisInsightGeneration } from './useAIAnalysisInsightGeneration';
import { useAIAnalysisQuestionGeneration } from './useAIAnalysisQuestionGeneration';

interface UseAIAnalysisGenerationActionsParams {
  question: string;
  aiSettings: {
    baseUrl: string;
    model: string;
    temperature: number;
  };
  timeline: TimelineData[];
  resolvedInsightDimension: InsightDimension;
  teamGroupForFacts: string;
  evidenceTarget: number;
  evidenceItems: EvidenceItem[];
  evidenceQuery: string;
  activeFilters: EvidenceFilters | null;
  insightEvidenceItems: EvidenceItem[];
  buildFilters: () => EvidenceFilters;
  ensureEvidence: () => Promise<{ items: EvidenceItem[]; filters: EvidenceFilters }>;
  generationStatus: 'idle' | 'running' | 'done' | 'error';
  generationRequestId: string | null;
  generationRunIdRef: MutableRefObject<string | null>;
  generationAbortRef: MutableRefObject<AbortController | null>;
  setGenerationError: (value: string | null) => void;
  setPlaylistMessage: (value: string | null) => void;
  setGenerationStatus: (value: 'idle' | 'running' | 'done' | 'error') => void;
  setAiResponse: (value: AiCopilotResponse | null) => void;
  setLlmRawText: (value: string | null) => void;
  setLlmLiveLog: Dispatch<SetStateAction<string>>;
  setLlmAttempt: (value: number) => void;
  setLlmRetryInfo: (value: {
    attempt: number;
    total: number;
    mode: 'reduce' | 'repair';
    reason: string;
  } | null) => void;
  setLlmDebug: (value: {
    stderr?: string;
    binaryPath?: string;
    modelPath?: string;
    durationMs?: number;
  } | null) => void;
  setLlmWarning: (value: string | null) => void;
  setLastQuestion: (value: string) => void;
  setGenerationRequestId: (value: string | null) => void;
  setLlmProgress: (value: {
    requestId: string;
    phase?: string;
    outputChars?: number;
    elapsedMs?: number;
  } | null) => void;
  setEvidenceItems: (value: EvidenceItem[]) => void;
  setActiveFilters: (value: EvidenceFilters | null) => void;
  setRetrievalStatus: (value: 'idle' | 'running' | 'done' | 'error') => void;
}

export const useAIAnalysisGenerationActions = ({
  question,
  aiSettings,
  timeline,
  resolvedInsightDimension,
  teamGroupForFacts,
  evidenceTarget,
  evidenceItems,
  evidenceQuery,
  activeFilters,
  insightEvidenceItems,
  buildFilters,
  ensureEvidence,
  generationStatus,
  generationRequestId,
  generationRunIdRef,
  generationAbortRef,
  setGenerationError,
  setPlaylistMessage,
  setGenerationStatus,
  setAiResponse,
  setLlmRawText,
  setLlmLiveLog,
  setLlmAttempt,
  setLlmRetryInfo,
  setLlmDebug,
  setLlmWarning,
  setLastQuestion,
  setGenerationRequestId,
  setLlmProgress,
  setEvidenceItems,
  setActiveFilters,
  setRetrievalStatus,
}: UseAIAnalysisGenerationActionsParams) => {
  const handleGenerate = useAIAnalysisQuestionGeneration({
    question,
    aiSettings,
    timeline,
    resolvedInsightDimension,
    teamGroupForFacts,
    evidenceTarget,
    evidenceItems,
    evidenceQuery,
    activeFilters,
    buildFilters,
    ensureEvidence,
    generationRunIdRef,
    generationAbortRef,
    setGenerationError,
    setPlaylistMessage,
    setGenerationStatus,
    setAiResponse,
    setLlmRawText,
    setLlmLiveLog,
    setLlmAttempt,
    setLlmRetryInfo,
    setLlmDebug,
    setLlmWarning,
    setLastQuestion,
    setGenerationRequestId,
    setLlmProgress,
  });

  const handleGenerateInsights = useAIAnalysisInsightGeneration({
    question,
    aiSettings,
    timeline,
    resolvedInsightDimension,
    teamGroupForFacts,
    evidenceTarget,
    insightEvidenceItems,
    buildFilters,
    generationRunIdRef,
    generationAbortRef,
    setGenerationError,
    setPlaylistMessage,
    setGenerationStatus,
    setAiResponse,
    setLlmRawText,
    setLlmLiveLog,
    setLlmAttempt,
    setLlmRetryInfo,
    setLlmDebug,
    setLlmWarning,
    setLastQuestion,
    setGenerationRequestId,
    setLlmProgress,
    setEvidenceItems,
    setActiveFilters,
    setRetrievalStatus,
  });

  const handleCancelGeneration = useCallback(async () => {
    if (generationStatus !== 'running') return;
    generationAbortRef.current?.abort();
    const requestId = generationRequestId ?? generationRunIdRef.current;
    if (requestId && globalThis.window?.electronAPI?.llama?.cancel) {
      await globalThis.window.electronAPI.llama.cancel(requestId);
    }
    generationRunIdRef.current = null;
    generationAbortRef.current = null;
    setGenerationRequestId(null);
    setLlmProgress(null);
    setLlmLiveLog('');
    setLlmAttempt(1);
    setLlmRetryInfo(null);
    setGenerationError('生成をキャンセルしました。');
    setGenerationStatus('idle');
  }, [
    generationAbortRef,
    generationRequestId,
    generationRunIdRef,
    generationStatus,
    setGenerationError,
    setGenerationRequestId,
    setGenerationStatus,
    setLlmAttempt,
    setLlmLiveLog,
    setLlmProgress,
    setLlmRetryInfo,
  ]);

  return {
    handleGenerate,
    handleCancelGeneration,
    handleGenerateInsights,
  };
};
