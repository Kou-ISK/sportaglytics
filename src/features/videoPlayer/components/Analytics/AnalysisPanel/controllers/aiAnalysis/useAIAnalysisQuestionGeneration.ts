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

interface UseAIAnalysisQuestionGenerationParams {
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
  buildFilters: () => EvidenceFilters;
  ensureEvidence: () => Promise<{
    items: EvidenceItem[];
    filters: EvidenceFilters;
  }>;
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
}

export const useAIAnalysisQuestionGeneration = ({
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
}: UseAIAnalysisQuestionGenerationParams) => {
  return useCallback(
    async (options?: { reuseEvidence?: boolean }) => {
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
      if (!trimmedQuestion) {
        setGenerationError('質問を入力してください。');
        setGenerationStatus('error');
        return;
      }
      setLastQuestion(trimmedQuestion);

      const { runId, controller } = startGenerationSession({
        generationRunIdRef,
        generationAbortRef,
        setGenerationRequestId,
        setLlmProgress,
      });

      const temperature = Number.isFinite(aiSettings.temperature)
        ? aiSettings.temperature
        : 0.2;

      try {
        const shouldReuse =
          options?.reuseEvidence &&
          evidenceItems.length > 0 &&
          evidenceQuery === trimmedQuestion;
        const ensured = shouldReuse
          ? { items: evidenceItems, filters: activeFilters ?? buildFilters() }
          : await ensureEvidence();
        if (generationRunIdRef.current !== runId) return;
        const evidenceInsight = buildEventInsights(
          mapEvidenceToTimeline(ensured.items),
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
          ensured.items,
          resolvedInsightDimension,
          teamGroupForFacts,
          trimmedQuestion,
          timeline,
        );
        const { response, rawText, debug, usedFallback, fallbackSource } =
          await generateAiResponse({
            question: trimmedQuestion,
            evidence: ensured.items,
            filters: ensured.filters,
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
              'LLMのJSON生成に失敗したため、根拠上位から推定結果を作成しました。',
              'JSON解析が不完全だったため、出力を補正して表示しています。',
            ),
          );
        } else {
          setLlmWarning(null);
        }
        setGenerationStatus('done');
      } catch (error) {
        console.debug('[AI] generate failed', error);
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
    },
    [
      activeFilters,
      aiSettings.baseUrl,
      aiSettings.model,
      aiSettings.temperature,
      buildFilters,
      ensureEvidence,
      evidenceItems,
      evidenceQuery,
      evidenceTarget,
      generationAbortRef,
      generationRunIdRef,
      question,
      resolvedInsightDimension,
      setAiResponse,
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
      teamGroupForFacts,
      timeline,
    ],
  );
};
