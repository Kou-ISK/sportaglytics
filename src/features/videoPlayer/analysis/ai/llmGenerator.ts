import { aiResponseSchema } from './schema';
import type { AiCopilotResponse, EvidenceFilters, EvidenceItem } from './types';
import { buildAugmentedPrompt, buildRepairPrompt } from './llmPrompt';
import { createLLMProvider } from './llmProvider';

export interface LlmGeneratorConfig {
  provider: 'llama.cpp';
  baseUrl: string;
  model: string;
  temperature?: number;
  timeoutMs?: number;
}

export interface LlmGeneratorOptions {
  maxRetries?: number;
  maxMemoChars?: number;
  maxEvidence?: number;
}

const tryParseJson = (text: string) => {
  try {
    return JSON.parse(text);
  } catch (_error) {
    return null;
  }
};

const extractJson = (rawText: string) => {
  const trimmed = rawText.trim();
  const direct = tryParseJson(trimmed);
  if (direct) return direct;

  const candidates: Array<{ start: number; end: number }> = [];
  const stack: number[] = [];
  for (let i = 0; i < rawText.length; i += 1) {
    const ch = rawText[i];
    if (ch === '{') {
      stack.push(i);
    } else if (ch === '}') {
      const start = stack.pop();
      if (start != null) {
        candidates.push({ start, end: i });
      }
    }
  }

  for (let i = candidates.length - 1; i >= 0; i -= 1) {
    const { start, end } = candidates[i];
    const slice = rawText.slice(start, end + 1);
    const parsed = tryParseJson(slice);
    if (parsed) return parsed;
  }

  throw new Error('JSON解析に失敗しました。');
};

export const generateAiResponse = async (params: {
  question: string;
  evidence: EvidenceItem[];
  filters?: EvidenceFilters;
  config: LlmGeneratorConfig;
  options?: LlmGeneratorOptions;
}): Promise<{ response: AiCopilotResponse; rawText: string }> => {
  if (!params.evidence || params.evidence.length === 0) {
    throw new Error('根拠がありません。');
  }
  const provider = createLLMProvider({
    type: params.config.provider,
    baseUrl: params.config.baseUrl,
    model: params.config.model,
    temperature: params.config.temperature,
    timeoutMs: params.config.timeoutMs,
  });
  const maxRetries = params.options?.maxRetries ?? 2;
  const maxEvidence = params.options?.maxEvidence ?? params.evidence.length;
  const trimmedEvidence = params.evidence.slice(0, Math.max(1, maxEvidence));
  let attempt = 0;
  let prompt = buildAugmentedPrompt({
    question: params.question,
    evidence: trimmedEvidence,
    filters: params.filters,
    maxMemoChars: params.options?.maxMemoChars,
  });
  let lastRaw = '';
  let lastError = '';

  while (attempt <= maxRetries) {
    const raw = await provider.generate({ prompt });
    lastRaw = raw;
    try {
      const parsed = extractJson(raw);
      const validated = aiResponseSchema.safeParse(parsed);
      if (validated.success) {
        return { response: validated.data, rawText: raw };
      } else {
        lastError = validated.error.message;
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'JSON解析に失敗しました。';
    }

    attempt += 1;
    if (attempt > maxRetries) break;
    prompt = buildRepairPrompt(raw, lastError);
  }

  throw new Error(
    `AI生成に失敗しました。${lastError ? `(${lastError})` : ''}`,
  );
};
