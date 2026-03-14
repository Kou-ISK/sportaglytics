import { useCallback, useEffect, useMemo } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { TimelineData } from '../../../../../../../types/TimelineData';
import {
  extractUniqueGroups,
  extractUniqueLabelsForGroup,
  getLabelsFromTimelineData,
} from '../../../../../../../utils/labelExtractors';
import type { EvidenceFilters, EvidenceItem } from '../../../../../analysis/ai';
import {
  buildEventInsights,
  filterTimelineByEvidenceFilters,
  type InsightDimension,
} from '../../../../../analysis/utils/eventInsights';
import {
  buildQuestionTemplates,
  collectFlowEvidenceIds,
  collectInsightEvidenceIds,
  parseNumberInput,
} from './aiAnalysisUtils';

interface UseAIAnalysisInsightStateParams {
  timeline: TimelineData[];
  evidenceById: Map<string, EvidenceItem>;
  teamLabelGroup: string;
  startTime: string;
  endTime: string;
  labelGroup: string;
  labelName: string;
  teamName: string;
  insightDimension: string;
  setInsightDimension: Dispatch<SetStateAction<string>>;
}

interface InsightDimensionOption {
  value: string;
  label: string;
}

interface AIAnalysisInsightState {
  availableGroups: string[];
  availableLabels: string[];
  availableTeamLabels: string[];
  effectiveTeamGroup: string;
  teamGroupForFacts: string;
  insightDimensionOptions: InsightDimensionOption[];
  resolvedInsightDimension: InsightDimension;
  resolvedInsightLabel: string;
  insightData: ReturnType<typeof buildEventInsights>;
  insightEvidenceItems: EvidenceItem[];
  flowEvidenceIds: string[];
  questionTemplates: string[];
  buildFilters: () => EvidenceFilters;
}

export const useAIAnalysisInsightState = ({
  timeline,
  evidenceById,
  teamLabelGroup,
  startTime,
  endTime,
  labelGroup,
  labelName,
  teamName,
  insightDimension,
  setInsightDimension,
}: UseAIAnalysisInsightStateParams): AIAnalysisInsightState => {
  const availableGroups = useMemo(() => extractUniqueGroups(timeline), [timeline]);

  const insightDimensionOptions = useMemo(() => {
    return [
      { value: 'auto', label: '自動' },
      { value: 'action', label: 'アクション名' },
      ...availableGroups.map((group) => ({
        value: `label:${group}`,
        label: `ラベル:${group}`,
      })),
    ];
  }, [availableGroups]);

  useEffect(() => {
    if (!insightDimension.startsWith('label:')) return;
    const group = insightDimension.replace('label:', '');
    if (!availableGroups.includes(group)) {
      setInsightDimension('auto');
    }
  }, [availableGroups, insightDimension, setInsightDimension]);

  const effectiveTeamGroup = useMemo(() => {
    if (teamLabelGroup) return teamLabelGroup;
    const detected = availableGroups.find((group) => group.toLowerCase() === 'team');
    return detected ?? '';
  }, [availableGroups, teamLabelGroup]);

  const teamGroupForFacts = useMemo(() => {
    if (!effectiveTeamGroup) return '';
    return availableGroups.includes(effectiveTeamGroup) ? effectiveTeamGroup : '';
  }, [availableGroups, effectiveTeamGroup]);

  const availableLabels = useMemo(() => {
    if (!labelGroup) return [];
    return extractUniqueLabelsForGroup(timeline, labelGroup);
  }, [timeline, labelGroup]);

  const availableTeamLabels = useMemo(() => {
    if (!effectiveTeamGroup) return [];
    return extractUniqueLabelsForGroup(timeline, effectiveTeamGroup);
  }, [timeline, effectiveTeamGroup]);

  const buildFilters = useCallback((): EvidenceFilters => {
    const filters: EvidenceFilters = {
      timeRange: {
        start: parseNumberInput(startTime),
        end: parseNumberInput(endTime),
      },
      labelFilters: [],
    };

    if (effectiveTeamGroup && teamName) {
      filters.labelFilters?.push({
        group: effectiveTeamGroup,
        name: teamName,
      });
    }

    if (labelGroup) {
      filters.labelFilters?.push({
        group: labelGroup,
        name: labelName || undefined,
      });
    }

    return filters;
  }, [effectiveTeamGroup, endTime, labelGroup, labelName, startTime, teamName]);

  const parseInsightDimension = useCallback((): InsightDimension => {
    if (insightDimension.startsWith('label:')) {
      const group = insightDimension.replace('label:', '');
      return { type: 'labelGroup', group };
    }
    return { type: 'action' };
  }, [insightDimension]);

  const insightFilters = useMemo(() => buildFilters(), [buildFilters]);
  const insightTimeline = useMemo(
    () => filterTimelineByEvidenceFilters(timeline, insightFilters),
    [insightFilters, timeline],
  );

  const resolvedInsightDimension = useMemo<InsightDimension>(() => {
    if (insightDimension !== 'auto') {
      return parseInsightDimension();
    }
    if (insightTimeline.length === 0 || availableGroups.length === 0) {
      return { type: 'action' };
    }
    let bestGroup = '';
    let bestScore = 0;
    for (const group of availableGroups) {
      let withLabel = 0;
      const values = new Set<string>();
      for (const item of insightTimeline) {
        const labels = getLabelsFromTimelineData(item);
        const label = labels.find(
          (entry) => (entry.group ?? '').toLowerCase() === group.toLowerCase(),
        );
        if (label?.name) {
          withLabel += 1;
          values.add(label.name);
        }
      }
      const coverage = withLabel / insightTimeline.length;
      if (coverage < 0.3) continue;
      const diversity = values.size / Math.max(2, Math.sqrt(insightTimeline.length));
      const score = coverage * 0.7 + Math.min(1, diversity) * 0.3;
      if (score > bestScore) {
        bestScore = score;
        bestGroup = group;
      }
    }
    return bestGroup ? { type: 'labelGroup', group: bestGroup } : { type: 'action' };
  }, [availableGroups, insightDimension, insightTimeline, parseInsightDimension]);

  const resolvedInsightLabel = useMemo(() => {
    if (resolvedInsightDimension.type === 'labelGroup') {
      return `ラベル:${resolvedInsightDimension.group}`;
    }
    return 'アクション名';
  }, [resolvedInsightDimension]);

  const insightData = useMemo(
    () =>
      buildEventInsights(insightTimeline, {
        dimension: resolvedInsightDimension,
        topN: 5,
        sequenceLength: 3,
        sequenceLengths: [3, 4],
        teamGroup: teamGroupForFacts,
        normalizeTeamActions: true,
      }),
    [insightTimeline, resolvedInsightDimension, teamGroupForFacts],
  );

  const insightEvidenceItems = useMemo(() => {
    const ids = collectInsightEvidenceIds(insightData);
    return ids.map((id) => evidenceById.get(id)).filter(Boolean) as EvidenceItem[];
  }, [evidenceById, insightData]);

  const flowEvidenceIds = useMemo(() => collectFlowEvidenceIds(insightData), [insightData]);

  const questionTemplates = useMemo(() => buildQuestionTemplates(timeline), [timeline]);

  return {
    availableGroups,
    availableLabels,
    availableTeamLabels,
    effectiveTeamGroup,
    teamGroupForFacts,
    insightDimensionOptions,
    resolvedInsightDimension,
    resolvedInsightLabel,
    insightData,
    insightEvidenceItems,
    flowEvidenceIds,
    questionTemplates,
    buildFilters,
  };
};
