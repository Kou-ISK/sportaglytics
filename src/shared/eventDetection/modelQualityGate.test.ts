import { describe, expect, it } from 'vitest';
import {
  getVerifiedEventTypes,
  passesEventDetectionQualityGate,
} from './modelQualityGate';

describe('event detection quality gate', () => {
  it('accepts metrics that meet every production threshold', () => {
    expect(
      passesEventDetectionQualityGate({
        precision: 0.96,
        recall: 0.92,
        evaluatedMatches: 6,
        confidenceThreshold: 0.9,
        timestampWithinTwoSecondsRate: 0.93,
      }),
    ).toBe(true);
  });

  it('rejects high aggregate scores when temporal accuracy is insufficient', () => {
    expect(
      passesEventDetectionQualityGate({
        precision: 0.98,
        recall: 0.95,
        evaluatedMatches: 8,
        confidenceThreshold: 0.9,
        timestampWithinTwoSecondsRate: 0.82,
      }),
    ).toBe(false);
  });

  it('promotes only event classes that independently pass the gate', () => {
    expect(
      getVerifiedEventTypes(['kickoff', 'scrum'], {
        kickoff: {
          precision: 0.97,
          recall: 0.94,
          evaluatedMatches: 7,
          confidenceThreshold: 0.92,
          timestampWithinTwoSecondsRate: 0.95,
        },
        scrum: {
          precision: 0.92,
          recall: 0.94,
          evaluatedMatches: 7,
          confidenceThreshold: 0.9,
          timestampWithinTwoSecondsRate: 0.95,
        },
      }),
    ).toEqual(['kickoff']);
  });
});
