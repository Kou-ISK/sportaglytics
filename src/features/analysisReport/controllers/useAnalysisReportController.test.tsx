/* @vitest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AnalysisReportPayload } from '../../../report/types';
import type { AnalysisReportPayloadMessage } from '../gateways/analysisReportGateway';
import { useAnalysisReportController } from './useAnalysisReportController';

const gatewayMocks = vi.hoisted(() => {
  let payloadHandler: ((message: AnalysisReportPayloadMessage) => void) | null =
    null;

  return {
    getPayloadHandler: () => payloadHandler,
    resetPayloadHandler: () => {
      payloadHandler = null;
    },
    getAnalysisReportRequestIdFromHash: vi.fn(() => 'expected-request'),
    subscribeToAnalysisReportPayload: vi.fn((handler) => {
      payloadHandler = handler;
      return vi.fn();
    }),
    notifyAnalysisReportRenderReady: vi.fn(() => Promise.resolve()),
  };
});

vi.mock('../gateways/analysisReportGateway', () => ({
  getAnalysisReportRequestIdFromHash:
    gatewayMocks.getAnalysisReportRequestIdFromHash,
  subscribeToAnalysisReportPayload:
    gatewayMocks.subscribeToAnalysisReportPayload,
  notifyAnalysisReportRenderReady: gatewayMocks.notifyAnalysisReportRenderReady,
}));

const createPayload = (): AnalysisReportPayload => ({
  meta: {
    generatedAt: '2026-03-13T00:00:00.000Z',
    teamName: 'Alpha vs Beta',
    timelineCount: 1,
    timelineSpanSec: 12,
    filtersSummary: 'none',
  },
  dashboard: {
    title: 'Dashboard',
    activeDashboardName: 'Main',
    cards: [],
    widgets: [],
    pages: [],
    filtersSummary: 'none',
  },
  momentum: {
    title: 'Momentum',
    segments: [],
    maxAbs: 0,
    teamNames: ['Alpha', 'Beta'],
    hasData: false,
    outcomeCounts: {
      Try: 0,
      Positive: 0,
      Negative: 0,
      Neutral: 0,
    },
  },
  matrix: {
    title: 'Matrix',
    axes: { row: 'team', column: 'action' },
    filterSummary: 'none',
    rowHeaders: [],
    columnHeaders: [],
    rowParentSpans: [],
    colParentSpans: [],
    values: [],
    visibleCount: 0,
    totalCount: 0,
    sections: [],
    referenceNote: 'none',
  },
});

describe('useAnalysisReportController', () => {
  beforeEach(() => {
    gatewayMocks.resetPayloadHandler();
    vi.clearAllMocks();
  });

  it('filters mismatched request ids and notifies render-ready for the matched payload', async () => {
    const { result } = renderHook(() => useAnalysisReportController());
    const payload = createPayload();

    expect(result.current.isLoading).toBe(true);
    expect(gatewayMocks.getPayloadHandler()).not.toBeNull();

    act(() => {
      gatewayMocks.getPayloadHandler()?.({
        requestId: 'another-request',
        payload,
      });
    });

    expect(result.current.payload).toBeNull();
    expect(gatewayMocks.notifyAnalysisReportRenderReady).not.toHaveBeenCalled();

    act(() => {
      gatewayMocks.getPayloadHandler()?.({
        requestId: 'expected-request',
        payload,
      });
    });

    await waitFor(() => {
      expect(result.current.payload).toEqual(payload);
    });

    expect(result.current.isLoading).toBe(false);
    await waitFor(() => {
      expect(gatewayMocks.notifyAnalysisReportRenderReady).toHaveBeenCalledWith(
        'expected-request',
      );
    });
  });
});
