import type { AiCopilotResponse, EvidenceItem } from './types';

export const FALLBACK_RESPONSE: AiCopilotResponse = {
  summary: 'AI出力を解析できませんでした。内容を短くして再実行してください。',
  hypotheses: [],
  evidenceHighlights: [],
  recommendedClips: [],
};

const uniqueIds = (ids: string[], limit = 5) => {
  const result: string[] = [];
  for (const id of ids) {
    if (!id) continue;
    if (!result.includes(id)) {
      result.push(id);
    }
    if (result.length >= limit) break;
  }
  return result;
};

export const buildFactBasedResponse = (
  facts: Record<string, unknown>,
  evidence: EvidenceItem[],
): AiCopilotResponse | null => {
  if (!facts || typeof facts !== 'object') return null;
  const evidenceMap = new Map(evidence.map((item) => [item.id, item]));
  const pickEvidenceTitle = (id: string) =>
    evidenceMap.get(id)?.actionName ?? id;

  const toArray = <T>(value: unknown): T[] =>
    Array.isArray(value) ? (value as T[]) : [];

  const topStates = toArray<{
    state: string;
    count: number;
    share: number;
    evidenceIds?: string[];
  }>((facts as Record<string, unknown>).topStates);
  const topTransitions = toArray<{
    from: string;
    to: string;
    count: number;
    probability: number;
    evidenceIds?: string[];
  }>((facts as Record<string, unknown>).topTransitions);
  const strongTransitions = toArray<{
    from: string;
    to: string;
    count: number;
    probability: number;
    evidenceIds?: string[];
  }>((facts as Record<string, unknown>).strongTransitions);
  const topSequences = toArray<{
    sequence: string[];
    count: number;
    evidenceIds?: string[];
  }>((facts as Record<string, unknown>).topSequences);
  const longestEvents = toArray<{ id: string; duration: number }>(
    (facts as Record<string, unknown>).longestEvents,
  );
  const phaseDistribution = toArray<{
    phase: 'early' | 'mid' | 'late';
    shareCount: number;
    evidenceIds?: string[];
  }>((facts as Record<string, unknown>).phaseDistribution);
  const summaryAnchors = toArray<{ text: string; evidenceIds?: string[] }>(
    (facts as Record<string, unknown>).summaryAnchors,
  );
  const analysisFocus = (facts as Record<string, unknown>).analysisFocus as
    | { notes?: string; intents?: string[] }
    | undefined;
  const contextStats = (facts as Record<string, unknown>).contextStats as
    | {
        target?: string;
        prevActions?: Array<{ key: string; evidenceIds?: string[] }>;
        nextActions?: Array<{ key: string; evidenceIds?: string[] }>;
      }
    | undefined;

  if (
    topStates.length === 0 &&
    topTransitions.length === 0 &&
    longestEvents.length === 0 &&
    topSequences.length === 0
  ) {
    return null;
  }

  const summaryParts: string[] = [];
  if (summaryAnchors.length > 0) {
    summaryAnchors.slice(0, 2).forEach((anchor) => {
      if (anchor.text) summaryParts.push(anchor.text);
    });
  } else if (evidence.length > 0) {
    summaryParts.push(`関連イベントは${evidence.length}件確認されました。`);
  }
  if (topStates[0]) {
    summaryParts.push(
      `「${topStates[0].state}」が多く含まれている可能性があります。`,
    );
  }
  const hasPhaseIntent = analysisFocus?.intents?.includes('phase');
  const hasContextIntent = analysisFocus?.intents?.includes('context');
  if (phaseDistribution.length > 0) {
    const phase = [...phaseDistribution].sort(
      (a, b) => b.shareCount - a.shareCount,
    )[0];
    if (phase && phase.shareCount >= 0.45) {
      const label =
        phase.phase === 'early'
          ? '前半'
          : phase.phase === 'mid'
            ? '中盤'
            : '後半';
      summaryParts.push(`イベントが${label}に偏る傾向があります。`);
    } else if (hasPhaseIntent) {
      summaryParts.push('時間帯の偏りは明確ではありません。');
    }
  } else if (hasPhaseIntent) {
    summaryParts.push('時間帯の偏りは明確ではありません。');
  }

  if (hasContextIntent) {
    const prev = contextStats?.prevActions?.[0];
    const next = contextStats?.nextActions?.[0];
    if (prev?.key) {
      summaryParts.push(
        `${contextStats?.target ?? '対象'}の直前は「${prev.key}」が多い可能性があります。`,
      );
    }
    if (next?.key) {
      summaryParts.push(
        `${contextStats?.target ?? '対象'}の直後は「${next.key}」が多い可能性があります。`,
      );
    }
    if (!prev?.key && !next?.key) {
      summaryParts.push('直前・直後で明確な偏りは確認できませんでした。');
    }
  } else if (!hasPhaseIntent) {
    if (topTransitions[0]) {
      summaryParts.push(
        `「${topTransitions[0].from}→${topTransitions[0].to}」の遷移が繰り返される示唆があります。`,
      );
    } else if (strongTransitions[0]) {
      summaryParts.push(
        `「${strongTransitions[0].from}→${strongTransitions[0].to}」の遷移が目立つ可能性があります。`,
      );
    }
    if (topSequences[0]) {
      summaryParts.push(
        `「${topSequences[0].sequence.join('→')}」の流れが複数回現れています。`,
      );
    }
  }
  if (summaryParts.length === 0) {
    summaryParts.push('特徴的なイベントの傾向が見られる可能性があります。');
  }
  if (
    summaryAnchors.length === 0 &&
    analysisFocus?.notes === 'no-clear-intent'
  ) {
    summaryParts.unshift('明確な偏りは確認できませんでした。');
  }

  const hypotheses: AiCopilotResponse['hypotheses'] = [];
  for (const transition of topTransitions.slice(0, 2)) {
    const ids = (transition.evidenceIds ?? []).filter((id) =>
      evidenceMap.has(id),
    );
    if (ids.length === 0) continue;
    hypotheses.push({
      text: `確認ポイント: ${transition.from}→${transition.to}の遷移が多く、展開に影響している可能性があります（要映像確認）。`,
      evidenceIds: ids.slice(0, 5),
    });
  }
  if (hypotheses.length === 0 && topStates[0]) {
    const ids = (topStates[0].evidenceIds ?? []).filter((id) =>
      evidenceMap.has(id),
    );
    if (ids.length > 0) {
      hypotheses.push({
        text: `確認ポイント: ${topStates[0].state}が頻出しており、試合展開に影響している可能性があります（要映像確認）。`,
        evidenceIds: ids.slice(0, 5),
      });
    }
  }
  if (hypotheses.length === 0 && topSequences[0]) {
    const ids = (topSequences[0].evidenceIds ?? []).filter((id) =>
      evidenceMap.has(id),
    );
    if (ids.length > 0) {
      hypotheses.push({
        text: `確認ポイント: ${topSequences[0].sequence.join('→')}の流れが続いている可能性があります（要映像確認）。`,
        evidenceIds: ids.slice(0, 5),
      });
    }
  }

  const evidenceHighlights: AiCopilotResponse['evidenceHighlights'] = [];
  for (const event of longestEvents.slice(0, 3)) {
    if (!evidenceMap.has(event.id)) continue;
    evidenceHighlights.push({
      id: event.id,
      why: `継続時間が長いイベント(${event.duration?.toFixed?.(1) ?? ''}秒)として抽出されました。`,
    });
  }
  if (evidenceHighlights.length === 0 && topStates[0]) {
    const ids = (topStates[0].evidenceIds ?? []).filter((id) =>
      evidenceMap.has(id),
    );
    if (ids[0]) {
      evidenceHighlights.push({
        id: ids[0],
        why: `頻出状態「${topStates[0].state}」の代表例です。`,
      });
    }
  }

  const recommendedClips: AiCopilotResponse['recommendedClips'] = [];
  const clipSourceIds = [
    ...evidenceHighlights.map((item) => item.id),
    ...hypotheses.flatMap((item) => item.evidenceIds),
  ];
  for (const id of uniqueIds(clipSourceIds, 3)) {
    if (!evidenceMap.has(id)) continue;
    recommendedClips.push({
      title: `${pickEvidenceTitle(id)} 確認`,
      centerId: id,
      preSeconds: 5,
      postSeconds: 5,
      reason: '特徴的なイベントの確認用です（要映像確認）。',
      evidenceIds: [id],
    });
  }

  return {
    summary: summaryParts.join(' '),
    hypotheses,
    evidenceHighlights,
    recommendedClips,
  };
};

export const buildHeuristicResponse = (
  evidence: EvidenceItem[],
): AiCopilotResponse => {
  if (evidence.length === 0) return FALLBACK_RESPONSE;

  const topEvidence = evidence.slice(0, Math.min(5, evidence.length));
  const actionCounts = new Map<string, number>();
  const labelCounts = new Map<string, number>();

  for (const item of evidence) {
    actionCounts.set(
      item.actionName,
      (actionCounts.get(item.actionName) ?? 0) + 1,
    );
    for (const label of item.labels) {
      const key = label.group ? `${label.group}:${label.name}` : label.name;
      labelCounts.set(key, (labelCounts.get(key) ?? 0) + 1);
    }
  }

  const topAction = Array.from(actionCounts.entries()).sort(
    (a, b) => b[1] - a[1],
  )[0];
  const topLabel = Array.from(labelCounts.entries()).sort(
    (a, b) => b[1] - a[1],
  )[0];

  const summaryParts: string[] = [];
  summaryParts.push(
    `関連度の高いイベントは${topEvidence.length}件確認されました。`,
  );
  if (topAction) {
    summaryParts.push(`特に「${topAction[0]}」が目立つ可能性があります。`);
  }
  if (topLabel) {
    summaryParts.push(
      `ラベルでは「${topLabel[0]}」が多く含まれる傾向があります。`,
    );
  }

  const hypotheses = [topAction, topLabel]
    .filter(Boolean)
    .slice(0, 2)
    .map((entry, index) => {
      const key = entry?.[0] ?? '';
      const evidenceIds = evidence
        .filter((item) =>
          index === 0
            ? item.actionName === key
            : item.labels.some(
                (label) =>
                  (label.group
                    ? `${label.group}:${label.name}`
                    : label.name) === key,
              ),
        )
        .slice(0, 5)
        .map((item) => item.id);
      return {
        text: `確認ポイント: ${key}が多く、試合展開に影響している可能性があります（要映像確認）。`,
        evidenceIds: evidenceIds.length > 0 ? evidenceIds : [topEvidence[0].id],
      };
    });

  const evidenceHighlights = topEvidence.slice(0, 3).map((item) => ({
    id: item.id,
    why: '関連度が高いイベントとして抽出されました。',
  }));

  const recommendedClips = topEvidence.slice(0, 3).map((item, index) => ({
    title: `${item.actionName} 確認${index + 1}`,
    centerId: item.id,
    preSeconds: 5,
    postSeconds: 5,
    reason: '関連度の高い根拠の確認用です（要映像確認）。',
    evidenceIds: [item.id],
  }));

  return {
    summary: summaryParts.join(' '),
    hypotheses,
    evidenceHighlights,
    recommendedClips,
  };
};
