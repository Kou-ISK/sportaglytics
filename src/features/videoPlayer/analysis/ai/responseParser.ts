import type { AiCopilotParseResult, AiCopilotResponse } from './types';

const FALLBACK_RESPONSE: AiCopilotResponse = {
  summary: 'AI応答の解析に失敗しました。要映像確認。',
  hypotheses: [],
  evidenceHighlights: [],
  recommendedClips: [],
};

const ensureReviewReminder = (response: AiCopilotResponse): AiCopilotResponse => {
  const combined = [
    response.summary,
    ...response.hypotheses.map((item) => item.text),
    ...response.recommendedClips.map((item) => item.reason),
  ].join(' ');
  if (combined.includes('要映像確認')) {
    return response;
  }
  return {
    ...response,
    summary: `${response.summary} 要映像確認。`.trim(),
  };
};

const parseJsonLoose = (rawText: string): unknown => {
  try {
    return JSON.parse(rawText);
  } catch (_error) {
    const start = rawText.indexOf('{');
    const end = rawText.lastIndexOf('}');
    if (start >= 0 && end > start) {
      const slice = rawText.slice(start, end + 1);
      return JSON.parse(slice);
    }
    throw _error;
  }
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
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const normalizeResponse = (value: unknown): AiCopilotResponse => {
  if (!value || typeof value !== 'object') return FALLBACK_RESPONSE;
  const obj = value as Record<string, unknown>;

  const summary = asString(obj.summary) ?? '';

  const hypothesesRaw = Array.isArray(obj.hypotheses) ? obj.hypotheses : [];
    const hypotheses = hypothesesRaw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const data = item as Record<string, unknown>;
      const text = asString(data.text);
      const evidenceIds = asStringArray(data.evidenceIds);
      if (!text || !evidenceIds) return null;
      return { text, evidenceIds };
    })
    .filter(Boolean) as AiCopilotResponse['hypotheses'];

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
      if (!title || !centerId || preSeconds == null || postSeconds == null || !reason) {
        return null;
      }
      return {
        title,
        centerId,
        preSeconds: Math.max(0, preSeconds),
        postSeconds: Math.max(0, postSeconds),
        reason,
        evidenceIds: [],
      };
    })
    .filter(Boolean) as AiCopilotResponse['recommendedClips'];

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

  return {
    summary: summary || FALLBACK_RESPONSE.summary,
    hypotheses,
    evidenceHighlights,
    recommendedClips,
  };
};

export const parseAiCopilotResponse = (rawText: string): AiCopilotParseResult => {
  try {
    const parsed = parseJsonLoose(rawText);
    const normalized = ensureReviewReminder(normalizeResponse(parsed));
    return {
      response: normalized,
      warnings: normalized.summary === FALLBACK_RESPONSE.summary ? ['empty-summary'] : [],
      rawText,
      usedFallback: false,
    };
  } catch (error) {
    return {
      response: FALLBACK_RESPONSE,
      warnings: ['parse-failed'],
      rawText,
      usedFallback: true,
    };
  }
};
