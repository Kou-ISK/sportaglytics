export const JSON_SCHEMA = JSON.stringify(
  {
    type: 'object',
    additionalProperties: false,
    required: [
      'summary',
      'hypotheses',
      'evidenceHighlights',
      'recommendedClips',
    ],
    properties: {
      summary: { type: 'string', maxLength: 500 },
      hypotheses: {
        type: 'array',
        maxItems: 3,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['text', 'evidenceIds'],
          properties: {
            text: { type: 'string', maxLength: 240 },
            evidenceIds: {
              type: 'array',
              items: { type: 'string' },
              minItems: 1,
              maxItems: 5,
            },
          },
        },
      },
      evidenceHighlights: {
        type: 'array',
        maxItems: 5,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['id', 'why'],
          properties: {
            id: { type: 'string' },
            why: { type: 'string', maxLength: 160 },
          },
        },
      },
      recommendedClips: {
        type: 'array',
        maxItems: 5,
        items: {
          type: 'object',
          additionalProperties: false,
          required: [
            'title',
            'centerId',
            'preSeconds',
            'postSeconds',
            'reason',
            'evidenceIds',
          ],
          properties: {
            title: { type: 'string', maxLength: 120 },
            centerId: { type: 'string' },
            preSeconds: { type: 'number' },
            postSeconds: { type: 'number' },
            reason: { type: 'string', maxLength: 240 },
            evidenceIds: {
              type: 'array',
              items: { type: 'string' },
              minItems: 1,
              maxItems: 5,
            },
          },
        },
      },
    },
  },
  null,
  2,
);

export const truncateLog = (value: string, maxChars: number): string => {
  if (value.length <= maxChars) return value;
  return value.slice(-maxChars);
};

export const normalizeLlamaOutput = (value: string): string => {
  const cleaned = value.replace(/\s*\[end of text\]\s*/gi, '');
  return cleaned.trim();
};

const hasRequiredKeys = (value: unknown): boolean => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.summary === 'string' &&
    Array.isArray(obj.hypotheses) &&
    Array.isArray(obj.evidenceHighlights) &&
    Array.isArray(obj.recommendedClips)
  );
};

export const extractJsonCandidate = (raw: string): string | null => {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed);
    if (hasRequiredKeys(parsed)) return trimmed;
  } catch (_error) {
    // continue searching
  }

  const candidates: Array<{ start: number; end: number; text: string }> = [];
  const stack: number[] = [];
  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];
    if (ch === '{') {
      stack.push(i);
    } else if (ch === '}') {
      const start = stack.pop();
      if (start != null) {
        candidates.push({
          start,
          end: i,
          text: raw.slice(start, i + 1),
        });
      }
    }
  }

  let best: string | null = null;
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate.text);
      if (hasRequiredKeys(parsed)) {
        if (!best || candidate.text.length > best.length) {
          best = candidate.text;
        }
      }
    } catch (_error) {
      // ignore
    }
  }

  return best;
};
