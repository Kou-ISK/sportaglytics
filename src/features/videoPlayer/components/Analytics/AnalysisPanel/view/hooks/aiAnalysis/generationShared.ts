import type {
  Dispatch,
  MutableRefObject,
  SetStateAction,
} from 'react';

export type GenerationStatus = 'idle' | 'running' | 'done' | 'error';

interface RetryInfo {
  attempt: number;
  maxRetries: number;
  mode: 'reduce' | 'repair';
  reason: string;
}

interface StartGenerationSessionParams {
  generationRunIdRef: MutableRefObject<string | null>;
  generationAbortRef: MutableRefObject<AbortController | null>;
  setGenerationRequestId: (value: string | null) => void;
  setLlmProgress: (value: {
    requestId: string;
    phase?: string;
    outputChars?: number;
    elapsedMs?: number;
  } | null) => void;
}

export interface GenerationUiResetters {
  setGenerationError: (value: string | null) => void;
  setPlaylistMessage: (value: string | null) => void;
  setGenerationStatus: (value: GenerationStatus) => void;
  setAiResponse: (value: null) => void;
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
}

export const resetGenerationUi = ({
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
}: GenerationUiResetters) => {
  setGenerationError(null);
  setPlaylistMessage(null);
  setGenerationStatus('running');
  setAiResponse(null);
  setLlmRawText(null);
  setLlmLiveLog('');
  setLlmAttempt(1);
  setLlmRetryInfo(null);
  setLlmDebug(null);
  setLlmWarning(null);
};

export const startGenerationSession = ({
  generationRunIdRef,
  generationAbortRef,
  setGenerationRequestId,
  setLlmProgress,
}: StartGenerationSessionParams) => {
  const runId = crypto.randomUUID();
  generationRunIdRef.current = runId;
  setGenerationRequestId(runId);
  setLlmProgress({
    requestId: runId,
    phase: 'start',
    outputChars: 0,
    elapsedMs: 0,
  });

  generationAbortRef.current?.abort();
  const controller = new AbortController();
  generationAbortRef.current = controller;

  return { runId, controller };
};

interface FinalizeGenerationSessionParams {
  runId: string;
  generationRunIdRef: MutableRefObject<string | null>;
  generationAbortRef: MutableRefObject<AbortController | null>;
  setGenerationRequestId: (value: string | null) => void;
  setLlmProgress: (value: {
    requestId: string;
    phase?: string;
    outputChars?: number;
    elapsedMs?: number;
  } | null) => void;
}

export const finalizeGenerationSession = ({
  runId,
  generationRunIdRef,
  generationAbortRef,
  setGenerationRequestId,
  setLlmProgress,
}: FinalizeGenerationSessionParams) => {
  if (generationRunIdRef.current !== runId) return;
  generationRunIdRef.current = null;
  generationAbortRef.current = null;
  setGenerationRequestId(null);
  setLlmProgress(null);
};

export const appendRetryMarker = (
  setLlmLiveLog: Dispatch<SetStateAction<string>>,
  info: RetryInfo,
) => {
  setLlmLiveLog((prev) => {
    const marker = `\n--- retry ${info.attempt}/${info.maxRetries + 1} (${info.mode}) ---\n`;
    const next = `${prev}${marker}`;
    return next.length <= 8000 ? next : next.slice(-8000);
  });
};

export const resolveFallbackWarning = (
  fallbackSource: 'heuristic' | 'repair' | 'none' | 'coerced',
  heuristicMessage: string,
  repairMessage: string,
) => {
  if (fallbackSource === 'heuristic') return heuristicMessage;
  return repairMessage;
};

export const applyGenerationError = (
  error: unknown,
  setGenerationError: (value: string | null) => void,
  setGenerationStatus: (value: GenerationStatus) => void,
) => {
  const message =
    error instanceof Error ? error.message : 'AI生成でエラーが発生しました。';
  const cancelled = message.includes('キャンセル');
  if (!cancelled) {
    setGenerationError(message);
    setGenerationStatus('error');
    return;
  }
  setGenerationError('生成をキャンセルしました。');
  setGenerationStatus('idle');
};
