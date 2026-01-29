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
  requestId?: string;
  signal?: AbortSignal;
}

type FallbackSource = 'none' | 'coerced' | 'heuristic';

const tryParseJson = (text: string) => {
  try {
    return JSON.parse(text);
  } catch (_error) {
    return null;
  }
};

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  );
};

const scoreCandidate = (value: unknown) => {
  if (!isPlainObject(value)) return 0;
  let score = 0;
  if (typeof value.summary === 'string') score += 3;
  if (Array.isArray(value.hypotheses)) score += 2;
  if (Array.isArray(value.evidenceHighlights)) score += 2;
  if (Array.isArray(value.recommendedClips)) score += 2;
  const validated = aiResponseSchema.safeParse(value);
  if (validated.success) score += 100;
  return score;
};

const extractJson = (rawText: string) => {
  const trimmed = rawText.trim();
  const direct = tryParseJson(trimmed);
  if (direct) return direct;

  const candidates: Array<{ start: number; end: number; text: string }> = [];
  const stack: number[] = [];
  for (let i = 0; i < rawText.length; i += 1) {
    const ch = rawText[i];
    if (ch === '{') {
      stack.push(i);
    } else if (ch === '}') {
      const start = stack.pop();
      if (start != null) {
        candidates.push({
          start,
          end: i,
          text: rawText.slice(start, i + 1),
        });
      }
    }
  }

  const parsedCandidates = candidates
    .map((candidate) => {
      const parsed = tryParseJson(candidate.text);
      if (!parsed) return null;
      return {
        ...candidate,
        parsed,
        score: scoreCandidate(parsed),
        length: candidate.end - candidate.start,
      };
    })
    .filter(Boolean) as Array<{
    start: number;
    end: number;
    text: string;
    parsed: unknown;
    score: number;
    length: number;
  }>;

  if (parsedCandidates.length === 0) {
    throw new Error('JSON解析に失敗しました。');
  }

  parsedCandidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.length - a.length;
  });

  if (parsedCandidates[0].score === 0) {
    throw new Error('JSON解析に失敗しました。');
  }

  return parsedCandidates[0].parsed;
};

const asString = (value: unknown): string | null =>
  typeof value === 'string' ? value : null;

const asStringArray = (value: unknown): string[] | null => {
  if (!Array.isArray(value)) return null;
  const filtered = value.filter((item) => typeof item === 'string');
  return filtered.length === value.length ? filtered : null;
};

const asNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return null;
};

const extractFirstObject = (value: unknown): Record<string, unknown> | null => {
  if (isPlainObject(value)) return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      if (isPlainObject(item)) return item;
    }
  }
  return null;
};

const coerceResponse = (value: unknown): AiCopilotResponse | null => {
  const obj = extractFirstObject(value);
  if (!obj) return null;
  const summary = asString(obj.summary);

  const hypothesesRaw = Array.isArray(obj.hypotheses) ? obj.hypotheses : [];
  const hypotheses = hypothesesRaw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const data = item as Record<string, unknown>;
      const text = asString(data.text);
      const evidenceIds = asStringArray(data.evidenceIds);
      if (!text || !evidenceIds || evidenceIds.length === 0) return null;
      return { text, evidenceIds };
    })
    .filter(Boolean) as AiCopilotResponse['hypotheses'];

  const highlightsRaw = Array.isArray(obj.evidenceHighlights)
    ? obj.evidenceHighlights
    : [];
  const evidenceHighlights = highlightsRaw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const data = item as Record<string, unknown>;
      const id = asString(data.id);
      const why = asString(data.why);
      if (!id || !why) return null;
      return { id, why };
    })
    .filter(Boolean) as AiCopilotResponse['evidenceHighlights'];

  const clipsRaw = Array.isArray(obj.recommendedClips)
    ? obj.recommendedClips
    : [];
  const recommendedClips = clipsRaw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const data = item as Record<string, unknown>;
      const title = asString(data.title);
      const centerId = asString(data.centerId);
      const preSeconds = asNumber(data.preSeconds);
      const postSeconds = asNumber(data.postSeconds);
      const reason = asString(data.reason);
      const evidenceIds = asStringArray(data.evidenceIds);
      if (
        !title ||
        !centerId ||
        preSeconds == null ||
        postSeconds == null ||
        !reason ||
        !evidenceIds ||
        evidenceIds.length === 0
      ) {
        return null;
      }
      return {
        title,
        centerId,
        preSeconds: Math.max(0, preSeconds),
        postSeconds: Math.max(0, postSeconds),
        reason,
        evidenceIds,
      };
    })
    .filter(Boolean) as AiCopilotResponse['recommendedClips'];

  const hasAny =
    Boolean(summary) ||
    hypotheses.length > 0 ||
    evidenceHighlights.length > 0 ||
    recommendedClips.length > 0;

  if (!hasAny) return null;

  return {
    summary: summary ?? '生成に失敗しました。',
    hypotheses,
    evidenceHighlights,
    recommendedClips,
  };
};

const FALLBACK_RESPONSE: AiCopilotResponse = {
  summary:
    'AI出力を解析できませんでした。内容を短くして再実行してください。',
  hypotheses: [],
  evidenceHighlights: [],
  recommendedClips: [],
};

const MAX_LLM_EVIDENCE = 24;

const uniqueIds = (ids: string[], limit = 5) => {
  const result: string[] = [];
  for (const id of ids) {
    if (!id) continue;
    if (!result.includes(id)) {
      result.push(id);
    }
    if (result.length >= limit) break;
  }
  return result;
};

const buildFactBasedResponse = (
  facts: Record<string, unknown>,
  evidence: EvidenceItem[],
): AiCopilotResponse | null => {
  if (!facts || typeof facts !== 'object') return null;
  const evidenceMap = new Map(evidence.map((item) => [item.id, item]));
  const pickEvidenceTitle = (id: string) =>
    evidenceMap.get(id)?.actionName ?? id;

  const toArray = <T>(value: unknown): T[] =>
    Array.isArray(value) ? (value as T[]) : [];

  const topStates = toArray<{
    state: string;
    count: number;
    share: number;
    evidenceIds?: string[];
  }>((facts as Record<string, unknown>).topStates);
  const topTransitions = toArray<{
    from: string;
    to: string;
    count: number;
    probability: number;
    evidenceIds?: string[];
  }>((facts as Record<string, unknown>).topTransitions);
  const topSequences = toArray<{
    sequence: string[];
    count: number;
    evidenceIds?: string[];
  }>((facts as Record<string, unknown>).topSequences);
  const longestEvents = toArray<{ id: string; duration: number }>(
    (facts as Record<string, unknown>).longestEvents,
  );

  if (
    topStates.length === 0 &&
    topTransitions.length === 0 &&
    longestEvents.length === 0 &&
    topSequences.length === 0
  ) {
    return null;
  }

  const summaryParts: string[] = [];
  if (evidence.length > 0) {
    summaryParts.push(`関連イベントは${evidence.length}件確認されました。`);
  }
  if (topStates[0]) {
    summaryParts.push(
      `「${topStates[0].state}」が多く含まれている可能性があります。`,
    );
  }
  if (topTransitions[0]) {
    summaryParts.push(
      `「${topTransitions[0].from}→${topTransitions[0].to}」の遷移が繰り返される示唆があります。`,
    );
  }
  if (topSequences[0]) {
    summaryParts.push(
      `「${topSequences[0].sequence.join('→')}」の流れが複数回現れています。`,
    );
  }
  if (summaryParts.length === 0) {
    summaryParts.push('特徴的なイベントの傾向が見られる可能性があります。');
  }

  const hypotheses: AiCopilotResponse['hypotheses'] = [];
  for (const transition of topTransitions.slice(0, 2)) {
    const ids = (transition.evidenceIds ?? []).filter((id) => evidenceMap.has(id));
    if (ids.length === 0) continue;
    hypotheses.push({
      text: `確認ポイント: ${transition.from}→${transition.to}の遷移が多く、展開に影響している可能性があります（要映像確認）。`,
      evidenceIds: ids.slice(0, 5),
    });
  }
  if (hypotheses.length === 0 && topStates[0]) {
    const ids = (topStates[0].evidenceIds ?? []).filter((id) => evidenceMap.has(id));
    if (ids.length > 0) {
      hypotheses.push({
        text: `確認ポイント: ${topStates[0].state}が頻出しており、試合展開に影響している可能性があります（要映像確認）。`,
        evidenceIds: ids.slice(0, 5),
      });
    }
  }
  if (hypotheses.length === 0 && topSequences[0]) {
    const ids = (topSequences[0].evidenceIds ?? []).filter((id) => evidenceMap.has(id));
    if (ids.length > 0) {
      hypotheses.push({
        text: `確認ポイント: ${topSequences[0].sequence.join('→')}の流れが続いている可能性があります（要映像確認）。`,
        evidenceIds: ids.slice(0, 5),
      });
    }
  }

  const evidenceHighlights: AiCopilotResponse['evidenceHighlights'] = [];
  for (const event of longestEvents.slice(0, 3)) {
    if (!evidenceMap.has(event.id)) continue;
    evidenceHighlights.push({
      id: event.id,
      why: `継続時間が長いイベント(${event.duration?.toFixed?.(1) ?? ''}秒)として抽出されました。`,
    });
  }
  if (evidenceHighlights.length === 0 && topStates[0]) {
    const ids = (topStates[0].evidenceIds ?? []).filter((id) => evidenceMap.has(id));
    if (ids[0]) {
      evidenceHighlights.push({
        id: ids[0],
        why: `頻出状態「${topStates[0].state}」の代表例です。`,
      });
    }
  }

  const recommendedClips: AiCopilotResponse['recommendedClips'] = [];
  const clipSourceIds = [
    ...(evidenceHighlights.map((item) => item.id)),
    ...(hypotheses.flatMap((item) => item.evidenceIds)),
  ];
  for (const id of uniqueIds(clipSourceIds, 3)) {
    if (!evidenceMap.has(id)) continue;
    recommendedClips.push({
      title: `${pickEvidenceTitle(id)} 確認`,
      centerId: id,
      preSeconds: 5,
      postSeconds: 5,
      reason: '特徴的なイベントの確認用です（要映像確認）。',
      evidenceIds: [id],
    });
  }

  return {
    summary: summaryParts.join(' '),
    hypotheses,
    evidenceHighlights,
    recommendedClips,
  };
};

const buildHeuristicResponse = (
  evidence: EvidenceItem[],
): AiCopilotResponse => {
  if (evidence.length === 0) return FALLBACK_RESPONSE;

  const topEvidence = evidence.slice(0, Math.min(5, evidence.length));
  const actionCounts = new Map<string, number>();
  const labelCounts = new Map<string, number>();

  for (const item of evidence) {
    actionCounts.set(item.actionName, (actionCounts.get(item.actionName) ?? 0) + 1);
    for (const label of item.labels) {
      const key = label.group ? `${label.group}:${label.name}` : label.name;
      labelCounts.set(key, (labelCounts.get(key) ?? 0) + 1);
    }
  }

  const topAction = Array.from(actionCounts.entries()).sort((a, b) => b[1] - a[1])[0];
  const topLabel = Array.from(labelCounts.entries()).sort((a, b) => b[1] - a[1])[0];

  const summaryParts: string[] = [];
  summaryParts.push(`関連度の高いイベントは${topEvidence.length}件確認されました。`);
  if (topAction) {
    summaryParts.push(`特に「${topAction[0]}」が目立つ可能性があります。`);
  }
  if (topLabel) {
    summaryParts.push(`ラベルでは「${topLabel[0]}」が多く含まれる傾向があります。`);
  }

  const hypotheses = [topAction, topLabel]
    .filter(Boolean)
    .slice(0, 2)
    .map((entry, index) => {
      const key = entry?.[0] ?? '';
      const evidenceIds = evidence
        .filter((item) =>
          index === 0
            ? item.actionName === key
            : item.labels.some((label) =>
                (label.group ? `${label.group}:${label.name}` : label.name) === key,
              ),
        )
        .slice(0, 5)
        .map((item) => item.id);
      return {
        text: `確認ポイント: ${key}が多く、試合展開に影響している可能性があります（要映像確認）。`,
        evidenceIds: evidenceIds.length > 0 ? evidenceIds : [topEvidence[0].id],
      };
    });

  const evidenceHighlights = topEvidence.slice(0, 3).map((item) => ({
    id: item.id,
    why: '関連度が高いイベントとして抽出されました。',
  }));

  const recommendedClips = topEvidence.slice(0, 3).map((item, index) => ({
    title: `${item.actionName} 確認${index + 1}`,
    centerId: item.id,
    preSeconds: 5,
    postSeconds: 5,
    reason: '関連度の高い根拠の確認用です（要映像確認）。',
    evidenceIds: [item.id],
  }));

  return {
    summary: summaryParts.join(' '),
    hypotheses,
    evidenceHighlights,
    recommendedClips,
  };
};

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
  const maxMemoChars = params.options?.maxMemoChars ?? 120;
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
  const buildPromptForAttempt = (index: number) =>
    buildAugmentedPrompt({
      question: params.question,
      evidence: evidenceSteps[Math.min(index, evidenceSteps.length - 1)],
      filters: params.filters,
      maxMemoChars: memoSteps[Math.min(index, memoSteps.length - 1)],
      facts: params.facts ?? null,
    });
  let prompt = buildPromptForAttempt(0);
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
      lastParsed = parsed;
      const validated = aiResponseSchema.safeParse(parsed);
      if (validated.success) {
        return {
          response: validated.data,
          rawText: result.text,
          debug: lastDebug,
          usedFallback: false,
          fallbackSource: 'none',
        };
      } else {
        lastError = validated.error.message;
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'JSON解析に失敗しました。';
    }

    attempt += 1;
    if (attempt > maxRetries) break;
    if (lastError.includes('JSON解析')) {
      prompt = buildPromptForAttempt(attempt);
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
        const heuristic = factFallback ?? buildHeuristicResponse(trimmedEvidence);
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
