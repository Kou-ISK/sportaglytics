import { expect, it } from 'vitest';
import { aiResponseSchema } from './schema';
import {
  extractJson,
  coerceResponse,
  sanitizeAiResponse,
} from './llmResponseNormalization';
import type { AiCopilotResponse, EvidenceItem } from './types';

const response: AiCopilotResponse = {
  summary: 'Synthetic summary',
  hypotheses: [{ text: 'Review this play', evidenceIds: ['e1'] }],
  evidenceHighlights: [{ id: 'e1', why: 'Synthetic evidence' }],
  recommendedClips: [
    {
      title: 'Example',
      centerId: 'e1',
      preSeconds: 0,
      postSeconds: 2.5,
      reason: 'Review',
      evidenceIds: ['e1'],
    },
  ],
};
const evidence: EvidenceItem[] = [
  {
    id: 'e1',
    actionName: 'Example',
    startTime: 10,
    endTime: 12,
    memo: '',
    labels: [],
    text: 'Synthetic evidence',
  },
];
it('keeps the existing response shape and strips unknown object keys', () => {
  const parsed = aiResponseSchema.safeParse({
    ...response,
    extra: 'unused',
    hypotheses: [{ ...response.hypotheses[0], extra: 'unused' }],
  });
  expect(parsed.success).toBe(true);
  if (!parsed.success) throw parsed.error;
  expect(parsed.data).toEqual(response);
  expect(sanitizeAiResponse(parsed.data, evidence)).toEqual(response);
  expect(extractJson('Example: ' + JSON.stringify(response) + ' End')).toEqual(
    response,
  );
});
it('keeps validation errors available to the existing repair path', () => {
  const parsed = aiResponseSchema.safeParse({
    ...response,
    summary: '',
    hypotheses: [{ text: 'x', evidenceIds: [] }],
  });
  expect(parsed.success).toBe(false);
  if (parsed.success) throw Error('invalid response accepted');
  expect(typeof parsed.error.message).toBe('string');
  expect(parsed.error.message).toContain('summary');
  expect(parsed.error.message).toContain('evidenceIds');
  expect(
    aiResponseSchema.safeParse({ summary: 'missing arrays' }).success,
  ).toBe(false);
});
it.each([NaN, Infinity, -Infinity])(
  'rejects nonfinite clip time %s and preserves the finite fallback',
  (preSeconds) => {
    const invalid = {
      ...response,
      recommendedClips: [{ ...response.recommendedClips[0], preSeconds }],
    };
    expect(aiResponseSchema.safeParse(invalid).success).toBe(false);
    expect(coerceResponse(invalid)?.recommendedClips).toEqual([]);
    expect(sanitizeAiResponse(invalid, evidence)).toEqual({
      ...response,
      recommendedClips: [],
    });
  },
);
it('keeps negative-time validation and the existing clamped fallback', () => {
  const invalid = {
    ...response,
    recommendedClips: [{ ...response.recommendedClips[0], postSeconds: -1 }],
  };
  expect(aiResponseSchema.safeParse(invalid).success).toBe(false);
  expect(coerceResponse(invalid)?.recommendedClips[0].postSeconds).toBe(0);
});
