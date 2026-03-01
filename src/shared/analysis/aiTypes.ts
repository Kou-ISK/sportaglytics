import type { SCLabel } from '../../types/SCTimeline';

export interface EvidenceItem {
  id: string;
  actionName: string;
  startTime: number;
  endTime: number;
  memo: string;
  labels: SCLabel[];
  text: string;
}

export interface EvidenceFilters {
  timeRange?: {
    start?: number | null;
    end?: number | null;
  };
  labelFilters?: Array<{
    group?: string;
    name?: string;
  }>;
}

export interface AiHypothesis {
  text: string;
  evidenceIds: string[];
}

export interface AiEvidenceHighlight {
  id: string;
  why: string;
}

export interface AiRecommendedClip {
  title: string;
  centerId: string;
  preSeconds: number;
  postSeconds: number;
  reason: string;
  evidenceIds: string[];
}

export interface AiCopilotResponse {
  summary: string;
  hypotheses: AiHypothesis[];
  evidenceHighlights: AiEvidenceHighlight[];
  recommendedClips: AiRecommendedClip[];
}

export interface AiCopilotParseResult {
  response: AiCopilotResponse;
  warnings: string[];
  rawText: string;
  usedFallback: boolean;
}

export interface AiClipSegment {
  startTime: number;
  endTime: number;
  title: string;
  centerIds: string[];
  reason: string;
  evidenceIds: string[];
}
