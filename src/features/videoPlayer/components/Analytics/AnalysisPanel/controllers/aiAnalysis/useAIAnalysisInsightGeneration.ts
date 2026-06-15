import {
  useCallback,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react';
import {
  generateAiResponse,
  type AiCopilotResponse,
  type EvidenceFilters,
  type EvidenceItem,
} from '../../../../../analysis/ai';
import {
  buildAiInsightFacts,
  buildEventInsights,
  type InsightDimension,
} from '../../../../../analysis/utils/eventInsights';
import {
  AUTO_INSIGHT_QUESTION,
  LLM_REPEAT_PENALTY,
  LLM_TOP_K,
  LLM_TOP_P,
  mapEvidenceToTimeline,
  MAX_LLM_RETRIES,
} from './aiAnalysisUtils';
import {
  appendRetryMarker,
  applyGenerationError,
  finalizeGenerationSession,
  resetGenerationUi,
  resolveFallbackWarning,
  startGenerationSession,
  type GenerationStatus,
} from './generationShared';
import type { TimelineData } from '../../../../../../../types/timeline/core';

interface UseAIAnalysisInsightGenerationParams {
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
  insightEvidenceItems: EvidenceItem[];
  buildFilters: () => EvidenceFilters;
  generationRunIdRef: MutableRefObject<string | null>;
  generationAbortRef: MutableRefObject<AbortController | null>;
  setGenerationError: (value: string | null) => void;
  setPlaylistMessage: (value: string | null) => void;
  setGenerationStatus: (value: GenerationStatus) => void;
  setAiResponse: (value: AiCopilotResponse | null) => void;
  setLlmRawText: (value: string | null) => void;
  setLlmLiveLog: Dispatch<SetStateAction<string>>;
  setLlmAttempt: (value: number) => void;
  setLlmRetryInfo: (
    value: {
      attempt: number;
      total: number;
      mode: 'reduce' | 'repair';
      reason: string;
    } | null,
  ) => void;
  setLlmDebug: (
    value: {
      stderr?: string;
      binaryPath?: string;
      modelPath?: string;
      durationMs?: number;
    } | null,
  ) => void;
  setLlmWarning: (value: string | null) => void;
  setLastQuestion: (value: string) => void;
  setGenerationRequestId: (value: string | null) => void;
  setLlmProgress: (
    value: {
      requestId: string;
      phase?: string;
      outputChars?: number;
      elapsedMs?: number;
    } | null,
  ) => void;
  setEvidenceItems: (value: EvidenceItem[]) => void;
  setActiveFilters: (value: EvidenceFilters | null) => void;
  setRetrievalStatus: (value: 'idle' | 'running' | 'done' | 'error') => void;
}

export const useAIAnalysisInsightGeneration = ({
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
}: UseAIAnalysisInsightGenerationParams) => {
  return useCallback(async () => {
    resetGenerationUi({
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
    });

    const trimmedQuestion = question.trim();
    const effectiveQuestion = trimmedQuestion || AUTO_INSIGHT_QUESTION;
    const displayQuestion = trimmedQuestion || 'インサイト自動生成';
    const temperature = Number.isFinite(aiSettings.temperature)
      ? aiSettings.temperature
      : 0.2;
    const filters = buildFilters();

    if (insightEvidenceItems.length === 0) {
      setGenerationError('インサイト用の根拠が不足しています。');
      setGenerationStatus('error');
      return;
    }

    setLastQuestion(displayQuestion);
    setEvidenceItems(insightEvidenceItems);
    setActiveFilters(filters);
    setRetrievalStatus('done');

    const { runId, controller } = startGenerationSession({
      generationRunIdRef,
      generationAbortRef,
      setGenerationRequestId,
      setLlmProgress,
    });
    const evidenceInsight = buildEventInsights(
      mapEvidenceToTimeline(insightEvidenceItems),
      {
        dimension: resolvedInsightDimension,
        topN: 4,
        sequenceLength: 3,
        sequenceLengths: [3, 4],
        teamGroup: teamGroupForFacts,
        normalizeTeamActions: true,
      },
    );
    const facts = buildAiInsightFacts(
      evidenceInsight,
      insightEvidenceItems,
      resolvedInsightDimension,
      teamGroupForFacts,
      effectiveQuestion,
      timeline,
    );

    try {
      const { response, rawText, debug, usedFallback, fallbackSource } =
        await generateAiResponse({
          question: effectiveQuestion,
          evidence: insightEvidenceItems,
          filters,
          facts: facts as Record<string, unknown>,
          config: {
            provider: 'llama.cpp',
            baseUrl: aiSettings.baseUrl,
            model: aiSettings.model,
            temperature,
            topP: LLM_TOP_P,
            topK: LLM_TOP_K,
            repeatPenalty: LLM_REPEAT_PENALTY,
          },
          options: {
            maxRetries: MAX_LLM_RETRIES,
            maxMemoChars: 90,
            maxEvidence: Math.max(1, evidenceTarget),
            requestId: runId,
            signal: controller.signal,
            onRetry: (info) => {
              setLlmAttempt(info.attempt);
              setLlmRetryInfo({
                attempt: info.attempt,
                total: info.maxRetries + 1,
                mode: info.mode,
                reason: info.reason,
              });
              appendRetryMarker(setLlmLiveLog, info);
            },
          },
        });
      if (generationRunIdRef.current !== runId) return;
      setAiResponse(response);
      setLlmRawText(rawText);
      setLlmDebug(debug ?? null);
      if (usedFallback) {
        setLlmWarning(
          resolveFallbackWarning(
            fallbackSource,
            'LLMのJSON生成に失敗したため、インサイト根拠から推定結果を作成しました。',
            'JSON解析が不完全だったため、出力を補正して表示しています。',
          ),
        );
      } else {
        setLlmWarning(null);
      }
      setGenerationStatus('done');
    } catch (error) {
      console.debug('[AI] generate insights failed', error);
      applyGenerationError(error, setGenerationError, setGenerationStatus);
    } finally {
      finalizeGenerationSession({
        runId,
        generationRunIdRef,
        generationAbortRef,
        setGenerationRequestId,
        setLlmProgress,
      });
    }
  }, [
    aiSettings.baseUrl,
    aiSettings.model,
    aiSettings.temperature,
    buildFilters,
    evidenceTarget,
    generationAbortRef,
    generationRunIdRef,
    insightEvidenceItems,
    question,
    resolvedInsightDimension,
    setActiveFilters,
    setAiResponse,
    setEvidenceItems,
    setGenerationError,
    setGenerationRequestId,
    setGenerationStatus,
    setLastQuestion,
    setLlmAttempt,
    setLlmDebug,
    setLlmLiveLog,
    setLlmProgress,
    setLlmRawText,
    setLlmRetryInfo,
    setLlmWarning,
    setPlaylistMessage,
    setRetrievalStatus,
    teamGroupForFacts,
    timeline,
  ]);
};
