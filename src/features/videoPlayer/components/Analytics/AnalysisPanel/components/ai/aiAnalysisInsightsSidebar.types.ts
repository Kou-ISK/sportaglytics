import type { SxProps, Theme } from '@mui/material/styles';
import type { TimelineData } from '../../../../../../../types/timeline/core';
import type { EvidenceItem } from '../../../../../analysis/ai';
import type { EventInsights } from '../../../../../analysis/utils/eventInsights';

export interface InsightDimensionOption {
  value: string;
  label: string;
}

export type InsightAccordionSx = SxProps<Theme>;

export interface AIAnalysisEvidenceAccordionProps {
  accordionSx: InsightAccordionSx;
  isOpen: boolean;
  onChange: (expanded: boolean) => void;
  groundedEvidence: EvidenceItem[];
  visibleEvidenceItems: EvidenceItem[];
  showAllEvidence: boolean;
  hiddenEvidenceCount: number;
  evidenceDefaultVisibleCount: number;
  onToggleShowAllEvidence: () => void;
  onJumpToSegment?: (segment: TimelineData) => void;
  formatSeconds: (value: number) => string;
}

export interface AIAnalysisInsightAccordionProps {
  accordionSx: InsightAccordionSx;
  isOpen: boolean;
  onChange: (expanded: boolean) => void;
  insightDimension: string;
  onInsightDimensionChange: (value: string) => void;
  insightDimensionOptions: InsightDimensionOption[];
  resolvedInsightLabel: string;
  insightData: EventInsights;
  timelineMap: Map<string, TimelineData>;
  onJumpToSegment?: (segment: TimelineData) => void;
  formatSeconds: (value: number) => string;
  formatPercent: (value: number, digits?: number) => string;
  formatDurationShort: (value: number) => string;
  formatGapShort: (value: number) => string;
}
