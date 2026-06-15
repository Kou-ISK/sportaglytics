import { useCallback, useEffect, useMemo } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import {
  buildClipSegments,
  type AiCopilotResponse,
  type AiEvidenceHighlight,
  type AiHypothesis,
  type AiRecommendedClip,
  type EvidenceItem,
} from '../../../../../analysis/ai';
import type { EventInsights } from '../../../../../analysis/utils/eventInsights';
import {
  EVIDENCE_DEFAULT_VISIBLE_COUNT,
  normalizeEvidenceId,
} from './aiAnalysisUtils';

interface UseAIAnalysisGroundedOutputParams {
  aiResponse: AiCopilotResponse | null;
  evidenceItems: EvidenceItem[];
  insightData: EventInsights;
  showAllEvidence: boolean;
  setShowAllEvidence: Dispatch<SetStateAction<boolean>>;
  question: string;
  lastQuestion: string;
  generationStatus: 'idle' | 'running' | 'done' | 'error';
}

interface AIAnalysisGroundedOutput {
  evidenceMap: Map<string, EvidenceItem>;
  validatedHighlights: AiEvidenceHighlight[];
  validatedHypotheses: AiHypothesis[];
  validatedClips: AiRecommendedClip[];
  groundedEvidence: EvidenceItem[];
  visibleEvidenceItems: EvidenceItem[];
  hiddenEvidenceCount: number;
  hasGroundedOutput: boolean;
  clipSegments: ReturnType<typeof buildClipSegments>;
  displayQuestion: string;
  stripEvidenceIds: (text: string, fallback?: string) => string;
}

export const useAIAnalysisGroundedOutput = ({
  aiResponse,
  evidenceItems,
  insightData,
  showAllEvidence,
  setShowAllEvidence,
  question,
  lastQuestion,
  generationStatus,
}: UseAIAnalysisGroundedOutputParams): AIAnalysisGroundedOutput => {
  const evidenceMap = useMemo(
    () => new Map(evidenceItems.map((item) => [item.id, item])),
    [evidenceItems],
  );

  const validatedHighlights: AiEvidenceHighlight[] = useMemo(() => {
    if (!aiResponse) return [];
    return aiResponse.evidenceHighlights
      .map((highlight) => ({
        ...highlight,
        id: normalizeEvidenceId(highlight.id),
      }))
      .filter((highlight) => highlight.id && evidenceMap.has(highlight.id));
  }, [aiResponse, evidenceMap]);

  const validatedHypotheses: AiHypothesis[] = useMemo(() => {
    if (!aiResponse) return [];
    return aiResponse.hypotheses
      .map((hypothesis) => ({
        ...hypothesis,
        evidenceIds: hypothesis.evidenceIds
          .map((id) => normalizeEvidenceId(id))
          .filter((id) => id && evidenceMap.has(id))
          .slice(0, 5),
      }))
      .filter((hypothesis) => hypothesis.evidenceIds.length > 0);
  }, [aiResponse, evidenceMap]);

  const validatedClips: AiRecommendedClip[] = useMemo(() => {
    if (!aiResponse) return [];
    return aiResponse.recommendedClips
      .map((clip) => ({
        ...clip,
        centerId: normalizeEvidenceId(clip.centerId),
        evidenceIds: clip.evidenceIds
          .map((id) => normalizeEvidenceId(id))
          .filter((id) => id && evidenceMap.has(id))
          .slice(0, 5),
      }))
      .filter(
        (clip) => evidenceMap.has(clip.centerId) && clip.evidenceIds.length > 0,
      );
  }, [aiResponse, evidenceMap]);

  const sequenceGroups = useMemo(() => {
    const groups: string[][] = [];
    insightData.topSequences.forEach((stat) => {
      if (stat.evidenceIds.length > 0) groups.push(stat.evidenceIds);
    });
    if (insightData.topSequencesByLength) {
      Object.values(insightData.topSequencesByLength).forEach((stats) => {
        stats.forEach((stat) => {
          if (stat.evidenceIds.length > 0) groups.push(stat.evidenceIds);
        });
      });
    }
    return groups;
  }, [insightData]);

  const groundedEvidence = useMemo(() => {
    const ids = new Set<string>();
    validatedHypotheses.forEach((item) =>
      item.evidenceIds.forEach((id) => ids.add(id)),
    );
    validatedHighlights.forEach((item) => ids.add(item.id));
    validatedClips.forEach((clip) => {
      clip.evidenceIds.forEach((id) => ids.add(id));
      ids.add(clip.centerId);
    });
    return evidenceItems.filter((item) => ids.has(item.id));
  }, [evidenceItems, validatedHypotheses, validatedHighlights, validatedClips]);

  const visibleEvidenceItems = useMemo(() => {
    if (showAllEvidence) return groundedEvidence;
    return groundedEvidence.slice(0, EVIDENCE_DEFAULT_VISIBLE_COUNT);
  }, [groundedEvidence, showAllEvidence]);

  const hiddenEvidenceCount = Math.max(
    0,
    groundedEvidence.length - visibleEvidenceItems.length,
  );

  useEffect(() => {
    if (groundedEvidence.length <= EVIDENCE_DEFAULT_VISIBLE_COUNT) {
      setShowAllEvidence(false);
    }
  }, [groundedEvidence.length, setShowAllEvidence]);

  const hasGroundedOutput =
    validatedHighlights.length > 0 ||
    validatedHypotheses.length > 0 ||
    validatedClips.length > 0;

  const clipSegments = useMemo(() => {
    return buildClipSegments(validatedClips, evidenceMap, {
      sequences: sequenceGroups,
    });
  }, [validatedClips, evidenceMap, sequenceGroups]);

  const displayQuestion = useMemo(() => {
    const trimmed = question.trim();
    if (lastQuestion) return lastQuestion;
    if (generationStatus === 'running') {
      return trimmed || 'インサイト自動生成';
    }
    return '';
  }, [generationStatus, lastQuestion, question]);

  const stripEvidenceIds = useCallback(
    (text: string, fallback = '（内容が不足しています）') => {
      if (!text) return fallback;
      let result = text;
      evidenceMap.forEach((_, id) => {
        if (id && result.includes(id)) {
          result = result.split(id).join('');
        }
      });
      const cleaned = result.replace(/\s{2,}/g, ' ').trim();
      return cleaned || fallback;
    },
    [evidenceMap],
  );

  return {
    evidenceMap,
    validatedHighlights,
    validatedHypotheses,
    validatedClips,
    groundedEvidence,
    visibleEvidenceItems,
    hiddenEvidenceCount,
    hasGroundedOutput,
    clipSegments,
    displayQuestion,
    stripEvidenceIds,
  };
};
