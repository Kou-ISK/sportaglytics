import { aiResponseSchema } from './schema';
import type { AiCopilotResponse, EvidenceItem } from './types';

const tryParseJson = (text: string) => {
  try {
    return JSON.parse(text);
  } catch (_error) {
    return null;
  }
};

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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

export const extractJson = (rawText: string) => {
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

const trimText = (value: string, maxChars: number): string => {
  if (value.length <= maxChars) return value;
  return value.slice(0, maxChars);
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

const clampArray = <T>(items: T[], max: number): T[] => {
  if (items.length <= max) return items;
  return items.slice(0, max);
};

const normalizeEvidenceIds = (
  ids: string[],
  allowed: Set<string>,
  max: number,
) => {
  const result: string[] = [];
  for (const id of ids) {
    if (!allowed.has(id)) continue;
    if (!result.includes(id)) {
      result.push(id);
    }
    if (result.length >= max) break;
  }
  return result;
};

export const buildEvidenceKeyMap = (evidence: EvidenceItem[]) => {
  const map = new Map<string, string>();
  evidence.forEach((item, index) => {
    map.set(item.id, `e${index + 1}`);
  });
  return map;
};

const invertEvidenceKeyMap = (map: Map<string, string>) => {
  const inverted = new Map<string, string>();
  for (const [id, key] of map.entries()) {
    inverted.set(key, id);
  }
  return inverted;
};

export const remapEvidenceKeys = (
  value: unknown,
  keyMap: Map<string, string>,
): unknown => {
  if (!value || typeof value !== 'object') return value;
  const inverted = invertEvidenceKeyMap(keyMap);

  const remapId = (id?: string | null) => {
    if (!id) return id;
    return inverted.get(id) ?? id;
  };

  const remapIds = (ids: string[] | null) => {
    if (!ids) return ids;
    return ids.map((id) => remapId(id) ?? id);
  };

  const obj = value as Record<string, unknown>;
  const remapped: Record<string, unknown> = { ...obj };
  if (Array.isArray(obj.hypotheses)) {
    remapped.hypotheses = obj.hypotheses.map((item) => {
      if (!item || typeof item !== 'object') return item;
      const data = item as Record<string, unknown>;
      return {
        ...data,
        evidenceIds: remapIds(asStringArray(data.evidenceIds)),
      };
    });
  }
  if (Array.isArray(obj.evidenceHighlights)) {
    remapped.evidenceHighlights = obj.evidenceHighlights.map((item) => {
      if (!item || typeof item !== 'object') return item;
      const data = item as Record<string, unknown>;
      return {
        ...data,
        id: remapId(asString(data.id)),
      };
    });
  }
  if (Array.isArray(obj.recommendedClips)) {
    remapped.recommendedClips = obj.recommendedClips.map((item) => {
      if (!item || typeof item !== 'object') return item;
      const data = item as Record<string, unknown>;
      return {
        ...data,
        centerId: remapId(asString(data.centerId)),
        evidenceIds: remapIds(asStringArray(data.evidenceIds)),
      };
    });
  }
  return remapped;
};

export const coerceResponse = (value: unknown): AiCopilotResponse | null => {
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

const MAX_SUMMARY_CHARS = 500;
const MAX_HYPOTHESIS_CHARS = 240;
const MAX_HIGHLIGHT_CHARS = 160;
const MAX_CLIP_TITLE_CHARS = 120;
const MAX_CLIP_REASON_CHARS = 240;
const MAX_HYPOTHESIS_ITEMS = 3;
const MAX_HIGHLIGHT_ITEMS = 5;
const MAX_CLIP_ITEMS = 5;
const MAX_EVIDENCE_IDS = 5;

export const sanitizeAiResponse = (
  value: unknown,
  evidence: EvidenceItem[],
): AiCopilotResponse | null => {
  const base = coerceResponse(value);
  if (!base) return null;
  const allowed = new Set(evidence.map((item) => item.id));
  const summary = trimText(
    base.summary || '生成に失敗しました。',
    MAX_SUMMARY_CHARS,
  );

  const hypotheses = clampArray(
    base.hypotheses
      .map((item) => {
        const evidenceIds = normalizeEvidenceIds(
          item.evidenceIds,
          allowed,
          MAX_EVIDENCE_IDS,
        );
        if (evidenceIds.length === 0) return null;
        const text = trimText(item.text, MAX_HYPOTHESIS_CHARS);
        if (!text) return null;
        return { text, evidenceIds };
      })
      .filter(Boolean) as AiCopilotResponse['hypotheses'],
    MAX_HYPOTHESIS_ITEMS,
  );

  const evidenceHighlights = clampArray(
    base.evidenceHighlights
      .map((item) => {
        if (!allowed.has(item.id)) return null;
        const why = trimText(item.why, MAX_HIGHLIGHT_CHARS);
        if (!why) return null;
        return { id: item.id, why };
      })
      .filter(Boolean) as AiCopilotResponse['evidenceHighlights'],
    MAX_HIGHLIGHT_ITEMS,
  );

  const recommendedClips = clampArray(
    base.recommendedClips
      .map((item) => {
        const evidenceIds = normalizeEvidenceIds(
          item.evidenceIds,
          allowed,
          MAX_EVIDENCE_IDS,
        );
        let centerId = item.centerId;
        if (!allowed.has(centerId)) {
          centerId = evidenceIds[0] ?? '';
        }
        if (!centerId || evidenceIds.length === 0) return null;
        const title = trimText(item.title, MAX_CLIP_TITLE_CHARS);
        const reason = trimText(item.reason, MAX_CLIP_REASON_CHARS);
        if (!title || !reason) return null;
        return {
          title,
          centerId,
          preSeconds: Math.max(0, item.preSeconds),
          postSeconds: Math.max(0, item.postSeconds),
          reason,
          evidenceIds,
        };
      })
      .filter(Boolean) as AiCopilotResponse['recommendedClips'],
    MAX_CLIP_ITEMS,
  );

  return {
    summary,
    hypotheses,
    evidenceHighlights,
    recommendedClips,
  };
};
