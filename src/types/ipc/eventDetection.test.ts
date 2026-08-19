import { describe, expect, it } from 'vitest';
import {
  isEventDetectionModelInfo,
  isEventDetectionModelStatus,
} from './eventDetection';

const modelInfo = {
  id: 'rugby-event-test',
  version: '0.1.0',
  displayName: 'Rugby Event Detection',
  events: ['restart'],
  metrics: {
    restart: {
      precision: 0.08,
      recall: 1,
      evaluatedMatches: 2,
      confidenceThreshold: 0.24,
    },
  },
};

describe('event detection model IPC guards', () => {
  it('accepts both supported model statuses', () => {
    expect(isEventDetectionModelStatus('verified')).toBe(true);
    expect(isEventDetectionModelStatus('experimental')).toBe(true);
  });

  it('rejects an unknown model status', () => {
    expect(isEventDetectionModelStatus('beta')).toBe(false);
    expect(isEventDetectionModelInfo({ ...modelInfo, status: 'beta' })).toBe(false);
  });

  it('round-trips a structurally valid experimental model', () => {
    expect(
      isEventDetectionModelInfo({ ...modelInfo, status: 'experimental' }),
    ).toBe(true);
  });

  it('rejects out-of-range metrics', () => {
    expect(
      isEventDetectionModelInfo({
        ...modelInfo,
        status: 'experimental',
        metrics: {
          restart: {
            ...modelInfo.metrics.restart,
            recall: 1.2,
          },
        },
      }),
    ).toBe(false);
  });
});
