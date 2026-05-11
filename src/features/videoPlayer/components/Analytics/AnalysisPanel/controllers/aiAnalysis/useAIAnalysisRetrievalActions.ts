import { useCallback } from 'react';
import type {
  AiCopilotResponse,
  EvidenceFilters,
  EvidenceItem,
  HybridEvidenceRetriever,
  RetrieverWeights,
} from '../../../../../analysis/ai';
import { buildEvidenceIndex } from '../../../../../analysis/ai';

interface UseAIAnalysisRetrievalActionsParams {
  question: string;
  buildFilters: () => EvidenceFilters;
  retriever: HybridEvidenceRetriever;
  evidenceIndex: ReturnType<typeof buildEvidenceIndex>;
  topK: number;
  retrieverWeights: RetrieverWeights;
  evidenceTarget: number;
  flowEvidenceIds: string[];
  setRetrievalError: (value: string | null) => void;
  setGenerationError: (value: string | null) => void;
  setPlaylistMessage: (value: string | null) => void;
  setRetrievalStatus: (value: 'idle' | 'running' | 'done' | 'error') => void;
  setAiResponse: (value: AiCopilotResponse | null) => void;
  setLlmRawText: (value: string | null) => void;
  setLlmDebug: (
    value: {
      stderr?: string;
      binaryPath?: string;
      modelPath?: string;
      durationMs?: number;
    } | null,
  ) => void;
  setLlmWarning: (value: string | null) => void;
  setEvidenceItems: (value: EvidenceItem[]) => void;
  setActiveFilters: (value: EvidenceFilters | null) => void;
  setLastQuestion: (value: string) => void;
  setEvidenceQuery: (value: string) => void;
}

export const useAIAnalysisRetrievalActions = ({
  question,
  buildFilters,
  retriever,
  evidenceIndex,
  topK,
  retrieverWeights,
  evidenceTarget,
  flowEvidenceIds,
  setRetrievalError,
  setGenerationError,
  setPlaylistMessage,
  setRetrievalStatus,
  setAiResponse,
  setLlmRawText,
  setLlmDebug,
  setLlmWarning,
  setEvidenceItems,
  setActiveFilters,
  setLastQuestion,
  setEvidenceQuery,
}: UseAIAnalysisRetrievalActionsParams) => {
  const handleRetrieveEvidence = useCallback(async () => {
    setRetrievalError(null);
    setGenerationError(null);
    setPlaylistMessage(null);
    setRetrievalStatus('running');
    setAiResponse(null);
    setLlmRawText(null);
    setLlmDebug(null);
    setLlmWarning(null);
    setEvidenceItems([]);
    setActiveFilters(null);

    const trimmedQuestion = question.trim();
    if (!trimmedQuestion) {
      setRetrievalError('質問を入力してください。');
      setRetrievalStatus('error');
      return;
    }
    setLastQuestion(trimmedQuestion);
    setEvidenceQuery(trimmedQuestion);

    const filters = buildFilters();

    try {
      const items = retriever.retrieve(trimmedQuestion, evidenceIndex, {
        topK,
        timeRange: filters.timeRange,
        labelFilters: filters.labelFilters,
        weights: retrieverWeights,
        diversify: { maxEvidence: evidenceTarget },
        insightEvidenceIds: flowEvidenceIds,
      });
      setEvidenceItems(items);
      setActiveFilters(filters);
      setRetrievalStatus('done');
      if (items.length === 0) {
        setRetrievalError('該当する根拠が見つかりませんでした。');
      }
    } catch (error) {
      console.debug('[AI] retrieval failed', error);
      setRetrievalError(
        error instanceof Error
          ? error.message
          : '根拠の検索でエラーが発生しました。',
      );
      setRetrievalStatus('error');
    }
  }, [
    buildFilters,
    evidenceIndex,
    evidenceTarget,
    flowEvidenceIds,
    question,
    retriever,
    retrieverWeights,
    setActiveFilters,
    setAiResponse,
    setEvidenceItems,
    setEvidenceQuery,
    setGenerationError,
    setLastQuestion,
    setLlmDebug,
    setLlmRawText,
    setLlmWarning,
    setPlaylistMessage,
    setRetrievalError,
    setRetrievalStatus,
    topK,
  ]);

  const ensureEvidence = useCallback(async () => {
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion) {
      throw new Error('質問を入力してください。');
    }
    setRetrievalStatus('running');
    const filters = buildFilters();
    try {
      const items = retriever.retrieve(trimmedQuestion, evidenceIndex, {
        topK,
        timeRange: filters.timeRange,
        labelFilters: filters.labelFilters,
        weights: retrieverWeights,
        diversify: { maxEvidence: evidenceTarget },
        insightEvidenceIds: flowEvidenceIds,
      });
      setEvidenceItems(items);
      setActiveFilters(filters);
      setRetrievalStatus('done');
      if (items.length === 0) {
        setRetrievalError('該当する根拠が見つかりませんでした。');
        setRetrievalStatus('error');
        throw new Error('該当する根拠が見つかりませんでした。');
      }
      setEvidenceQuery(trimmedQuestion);
      return { items, filters };
    } catch (error) {
      setRetrievalStatus('error');
      if (error instanceof Error) {
        setRetrievalError(error.message);
      } else {
        setRetrievalError('根拠の検索でエラーが発生しました。');
      }
      throw error;
    }
  }, [
    buildFilters,
    evidenceIndex,
    evidenceTarget,
    flowEvidenceIds,
    question,
    retriever,
    retrieverWeights,
    setActiveFilters,
    setEvidenceItems,
    setEvidenceQuery,
    setRetrievalError,
    setRetrievalStatus,
    topK,
  ]);

  return {
    handleRetrieveEvidence,
    ensureEvidence,
  };
};
