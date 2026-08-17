import { describe, expect, it } from 'vitest';
import {
  getVerifiedEventTypes,
  passesEventDetectionQualityGate,
} from './modelQualityGate';

describe('event detection quality gate', () => {
  it('accepts a high-recall operating point even when precision is moderate', () => {
    expect(
      passesEventDetectionQualityGate({
        precision: 0.72,
        recall: 0.97,
        evaluatedMatches: 6,
        confidenceThreshold: 0.42,
        timestampWithinTwoSecondsRate: 0.6,
      }),
    ).toBe(true);
  });

  it('rejects a precise detector that misses too many events', () => {
    expect(
      passesEventDetectionQualityGate({
        precision: 0.99,
        recall: 0.9,
        evaluatedMatches: 8,
        confidenceThreshold: 0.9,
        timestampWithinTwoSecondsRate: 0.99,
      }),
    ).toBe(false);
  });

  it('promotes only event classes that independently meet recall and evaluation coverage', () => {
    expect(
      getVerifiedEventTypes(['restart', 'scrum'], {
        restart: {
          precision: 0.68,
          recall: 0.96,
          evaluatedMatches: 7,
          confidenceThreshold: 0.4,
        },
        scrum: {
          precision: 0.95,
          recall: 0.91,
          evaluatedMatches: 7,
          confidenceThreshold: 0.85,
        },
      }),
    ).toEqual(['restart']);
  });
});
