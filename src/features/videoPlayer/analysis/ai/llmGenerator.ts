import { aiResponseSchema } from './schema';
import type { AiCopilotResponse, EvidenceFilters, EvidenceItem } from './types';
import { buildAugmentedPrompt, buildRepairPrompt } from './llmPrompt';
import { createLLMProvider } from './llmProvider';
import {
  buildFactBasedResponse,
  buildHeuristicResponse,
  FALLBACK_RESPONSE,
} from './llmFallbackResponses';
import {
  buildEvidenceKeyMap,
  coerceResponse,
  extractJson,
  remapEvidenceKeys,
  sanitizeAiResponse,
} from './llmResponseNormalization';

interface LlmGeneratorConfig {
  provider: 'llama.cpp';
  baseUrl: string;
  model: string;
  temperature?: number;
  topP?: number;
  topK?: number;
  repeatPenalty?: number;
  timeoutMs?: number;
}

interface LlmGeneratorOptions {
  maxRetries?: number;
  maxMemoChars?: number;
  maxEvidence?: number;
  requestId?: string;
  signal?: AbortSignal;
  onRetry?: (payload: {
    attempt: number;
    maxRetries: number;
    reason: string;
    mode: 'reduce' | 'repair';
  }) => void;
}

type FallbackSource = 'none' | 'coerced' | 'heuristic';

const MAX_LLM_EVIDENCE = 30;

export const generateAiResponse = async (params: {
  question: string;
  evidence: EvidenceItem[];
  filters?: EvidenceFilters;
  config: LlmGeneratorConfig;
  options?: LlmGeneratorOptions;
  facts?: Record<string, unknown> | null;
}): Promise<{
  response: AiCopilotResponse;
  rawText: string;
  debug?: {
    stderr?: string;
    binaryPath?: string;
    modelPath?: string;
    durationMs?: number;
  };
  usedFallback: boolean;
  validationError?: string;
  fallbackSource: FallbackSource;
}> => {
  if (!params.evidence || params.evidence.length === 0) {
    throw new Error('根拠がありません。');
  }

  const signal = params.options?.signal;
  const requestId = params.options?.requestId;
  const provider = createLLMProvider({
    type: params.config.provider,
    baseUrl: params.config.baseUrl,
    model: params.config.model,
    temperature: params.config.temperature,
    topP: params.config.topP,
    topK: params.config.topK,
    repeatPenalty: params.config.repeatPenalty,
    timeoutMs: params.config.timeoutMs,
  });

  const maxRetries = params.options?.maxRetries ?? 2;
  const maxEvidence = Math.min(
    params.options?.maxEvidence ?? params.evidence.length,
    MAX_LLM_EVIDENCE,
  );
  const trimmedEvidence = params.evidence.slice(0, Math.max(1, maxEvidence));
  const factFallback = params.facts
    ? buildFactBasedResponse(params.facts, trimmedEvidence)
    : null;

  const maxMemoChars = params.options?.maxMemoChars ?? 90;
  const evidenceSteps = [
    trimmedEvidence,
    trimmedEvidence.slice(0, Math.max(1, Math.min(8, trimmedEvidence.length))),
    trimmedEvidence.slice(0, Math.max(1, Math.min(5, trimmedEvidence.length))),
  ];
  const memoSteps = [
    maxMemoChars,
    Math.max(80, Math.floor(maxMemoChars * 0.75)),
    Math.max(60, Math.floor(maxMemoChars * 0.5)),
  ];

  let attempt = 0;
  const buildPromptForAttempt = (index: number) => {
    const evidence = evidenceSteps[Math.min(index, evidenceSteps.length - 1)];
    const evidenceKeyMap = buildEvidenceKeyMap(evidence);
    return {
      prompt: buildAugmentedPrompt({
        question: params.question,
        evidence,
        filters: params.filters,
        maxMemoChars: memoSteps[Math.min(index, memoSteps.length - 1)],
        facts: params.facts ?? null,
        evidenceKeyMap,
      }),
      evidenceKeyMap,
    };
  };

  let { prompt, evidenceKeyMap: currentEvidenceKeyMap } =
    buildPromptForAttempt(0);
  let lastRaw = '';
  let lastError = '';
  let lastParsed: unknown | null = null;
  let lastDebug:
    | {
        stderr?: string;
        binaryPath?: string;
        modelPath?: string;
        durationMs?: number;
      }
    | undefined;

  while (attempt <= maxRetries) {
    if (signal?.aborted) {
      throw new Error('生成がキャンセルされました。');
    }

    const result = await provider.generate({
      prompt,
      requestId,
      signal,
    });

    if (signal?.aborted) {
      throw new Error('生成がキャンセルされました。');
    }

    lastRaw = result.text;
    lastDebug = result.debug;

    try {
      const parsed = extractJson(result.text);
      const remapped = currentEvidenceKeyMap
        ? remapEvidenceKeys(parsed, currentEvidenceKeyMap)
        : parsed;
      lastParsed = remapped;

      const validated = aiResponseSchema.safeParse(remapped);
      if (validated.success) {
        return {
          response: validated.data,
          rawText: result.text,
          debug: lastDebug,
          usedFallback: false,
          fallbackSource: 'none',
        };
      }

      lastError = validated.error.message;
      const sanitized = sanitizeAiResponse(remapped, trimmedEvidence);
      if (sanitized) {
        return {
          response: sanitized,
          rawText: result.text,
          debug: lastDebug,
          usedFallback: true,
          validationError: lastError,
          fallbackSource: 'coerced',
        };
      }
    } catch (error) {
      lastError =
        error instanceof Error ? error.message : 'JSON解析に失敗しました。';
    }

    attempt += 1;
    if (attempt > maxRetries) break;

    const isParseError = lastError.includes('JSON解析');
    const mode: 'reduce' | 'repair' = isParseError ? 'reduce' : 'repair';
    params.options?.onRetry?.({
      attempt: attempt + 1,
      maxRetries,
      reason: lastError,
      mode,
    });

    if (isParseError) {
      const nextPrompt = buildPromptForAttempt(attempt);
      prompt = nextPrompt.prompt;
      currentEvidenceKeyMap = nextPrompt.evidenceKeyMap;
    } else {
      prompt = buildRepairPrompt(result.text, lastError);
    }
  }

  if (lastParsed) {
    const fallback = coerceResponse(lastParsed);
    if (fallback) {
      const hasGrounded =
        fallback.hypotheses.length > 0 ||
        fallback.evidenceHighlights.length > 0 ||
        fallback.recommendedClips.length > 0;
      if (!hasGrounded) {
        const heuristic =
          factFallback ?? buildHeuristicResponse(trimmedEvidence);
        return {
          response: heuristic ?? FALLBACK_RESPONSE,
          rawText: lastRaw,
          debug: lastDebug,
          usedFallback: true,
          validationError: lastError,
          fallbackSource: 'heuristic',
        };
      }
      return {
        response: fallback,
        rawText: lastRaw,
        debug: lastDebug,
        usedFallback: true,
        validationError: lastError,
        fallbackSource: 'coerced',
      };
    }
  }

  const heuristic = factFallback ?? buildHeuristicResponse(trimmedEvidence);
  return {
    response: heuristic ?? FALLBACK_RESPONSE,
    rawText: lastRaw,
    debug: lastDebug,
    usedFallback: true,
    validationError: lastError,
    fallbackSource: 'heuristic',
  };
};
