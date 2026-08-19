import { describe, expect, it } from 'vitest';
import type { EventDetectionModelInfo } from '../../../../types/eventDetection/core';
import {
  applyEventTimelineMappingUpdates,
  buildEventDetectionMappings,
} from './eventDetectionMappings';

const experimentalModel: EventDetectionModelInfo = {
  id: 'rugby-event-test',
  version: '0.1.0-experimental.1',
  displayName: 'Rugby Event Detection',
  status: 'experimental',
  events: ['restart', 'scrum', 'lineout'],
  metrics: {
    restart: {
      precision: 0.084,
      recall: 1,
      evaluatedMatches: 2,
      confidenceThreshold: 0.24,
    },
    scrum: {
      precision: 0.18,
      recall: 0.9524,
      evaluatedMatches: 2,
      confidenceThreshold: 0.57,
    },
    lineout: {
      precision: 0.083,
      recall: 0.9643,
      evaluatedMatches: 2,
      confidenceThreshold: 0.21,
    },
  },
};

describe('event detection mappings', () => {
  it('uses the manifest confidence threshold as the initial value', () => {
    const mappings = buildEventDetectionMappings(experimentalModel);

    expect(mappings.map((mapping) => mapping.minConfidence)).toEqual([
      0.24, 0.57, 0.21,
    ]);
  });

  it('preserves a user-edited confidence threshold', () => {
    const [mapping] = buildEventDetectionMappings(experimentalModel);
    if (!mapping) throw new Error('Expected restart mapping');

    const updated = applyEventTimelineMappingUpdates(mapping, {
      minConfidence: 0.68,
    });

    expect(updated.minConfidence).toBe(0.68);
  });

  it('clamps confidence and range updates to supported bounds', () => {
    const [mapping] = buildEventDetectionMappings(experimentalModel);
    if (!mapping) throw new Error('Expected restart mapping');

    expect(
      applyEventTimelineMappingUpdates(mapping, { minConfidence: -0.2 })
        .minConfidence,
    ).toBe(0);
    expect(
      applyEventTimelineMappingUpdates(mapping, { minConfidence: 1.4 })
        .minConfidence,
    ).toBe(1);

    const updated = applyEventTimelineMappingUpdates(mapping, {
      leadTimeSeconds: -10,
      lagTimeSeconds: 900,
    });
    expect(updated.leadTimeSeconds).toBe(0);
    expect(updated.lagTimeSeconds).toBe(600);
  });

  it('falls back to the previous threshold for non-finite input', () => {
    const [mapping] = buildEventDetectionMappings(experimentalModel);
    if (!mapping) throw new Error('Expected restart mapping');

    const updated = applyEventTimelineMappingUpdates(mapping, {
      minConfidence: Number.NaN,
    });

    expect(updated.minConfidence).toBe(0.24);
  });
});
