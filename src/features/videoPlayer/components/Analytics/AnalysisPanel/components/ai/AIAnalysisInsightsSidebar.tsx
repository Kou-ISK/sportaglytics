import React from 'react';
import type { TimelineData } from '../../../../../../../types/TimelineData';
import type { EvidenceItem } from '../../../../../analysis/ai';
import type { EventInsights } from '../../../../../analysis/utils/eventInsights';
import { AIAnalysisEvidenceAccordion } from './AIAnalysisEvidenceAccordion';
import { AIAnalysisInsightAccordion } from './AIAnalysisInsightAccordion';
import type { InsightAccordionSx, InsightDimensionOption } from './aiAnalysisInsightsSidebar.types';

interface AIAnalysisInsightsSidebarProps {
  accordionSx: InsightAccordionSx;
  isEvidenceAccordionOpen: boolean;
  onEvidenceAccordionChange: (expanded: boolean) => void;
  groundedEvidence: EvidenceItem[];
  visibleEvidenceItems: EvidenceItem[];
  showAllEvidence: boolean;
  hiddenEvidenceCount: number;
  evidenceDefaultVisibleCount: number;
  onToggleShowAllEvidence: () => void;
  onJumpToSegment?: (segment: TimelineData) => void;
  isInsightAccordionOpen: boolean;
  onInsightAccordionChange: (expanded: boolean) => void;
  insightDimension: string;
  onInsightDimensionChange: (value: string) => void;
  insightDimensionOptions: InsightDimensionOption[];
  resolvedInsightLabel: string;
  insightData: EventInsights;
  timelineMap: Map<string, TimelineData>;
  formatSeconds: (value: number) => string;
  formatPercent: (value: number, digits?: number) => string;
  formatDurationShort: (value: number) => string;
  formatGapShort: (value: number) => string;
}

export const AIAnalysisInsightsSidebar = ({
  accordionSx,
  isEvidenceAccordionOpen,
  onEvidenceAccordionChange,
  groundedEvidence,
  visibleEvidenceItems,
  showAllEvidence,
  hiddenEvidenceCount,
  evidenceDefaultVisibleCount,
  onToggleShowAllEvidence,
  onJumpToSegment,
  isInsightAccordionOpen,
  onInsightAccordionChange,
  insightDimension,
  onInsightDimensionChange,
  insightDimensionOptions,
  resolvedInsightLabel,
  insightData,
  timelineMap,
  formatSeconds,
  formatPercent,
  formatDurationShort,
  formatGapShort,
}: AIAnalysisInsightsSidebarProps) => {
  return (
    <>
      <AIAnalysisEvidenceAccordion
        accordionSx={accordionSx}
        isOpen={isEvidenceAccordionOpen}
        onChange={onEvidenceAccordionChange}
        groundedEvidence={groundedEvidence}
        visibleEvidenceItems={visibleEvidenceItems}
        showAllEvidence={showAllEvidence}
        hiddenEvidenceCount={hiddenEvidenceCount}
        evidenceDefaultVisibleCount={evidenceDefaultVisibleCount}
        onToggleShowAllEvidence={onToggleShowAllEvidence}
        onJumpToSegment={onJumpToSegment}
        formatSeconds={formatSeconds}
      />
      <AIAnalysisInsightAccordion
        accordionSx={accordionSx}
        isOpen={isInsightAccordionOpen}
        onChange={onInsightAccordionChange}
        insightDimension={insightDimension}
        onInsightDimensionChange={onInsightDimensionChange}
        insightDimensionOptions={insightDimensionOptions}
        resolvedInsightLabel={resolvedInsightLabel}
        insightData={insightData}
        timelineMap={timelineMap}
        onJumpToSegment={onJumpToSegment}
        formatSeconds={formatSeconds}
        formatPercent={formatPercent}
        formatDurationShort={formatDurationShort}
        formatGapShort={formatGapShort}
      />
    </>
  );
};
