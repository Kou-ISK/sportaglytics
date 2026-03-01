import { getLabelsFromTimelineData } from '../../../../../../../../utils/labelExtractors';
import type { TimelineData } from '../../../../../../../../types/TimelineData';
import type {
  EvidenceItem,
  RetrieverWeights,
} from '../../../../../../analysis/ai';
import type { EventInsights } from '../../../../../../analysis/utils/eventInsights';

export const MAX_LLM_RETRIES = 1;
export const LLM_TOP_P = 0.85;
export const LLM_TOP_K = 40;
export const LLM_REPEAT_PENALTY = 1.1;

export const AUTO_INSIGHT_QUESTION =
  '全体の傾向と特徴的なイベントを要約し、根拠付きで仮説とクリップ候補を提示してください。';

const DEFAULT_QUESTION_TEMPLATES = [
  '重要な流れの変化点は？',
  '頻出アクションの流れは？',
  '前半/中盤/後半で偏りは？',
  '直前・直後で目立つ出来事は？',
  '長く続いた出来事は？',
];

const TEAM_SPLIT_REGEX = /[\s\u3000/／・\\\-–—_]+/;

const splitTeamActionName = (
  actionName: string,
): { team: string; action: string } | null => {
  const trimmed = (actionName ?? '').trim();
  if (!trimmed) return null;
  const parts = trimmed.split(TEAM_SPLIT_REGEX).filter(Boolean);
  if (parts.length < 2) return null;
  const team = parts[0]?.trim();
  const action = parts.slice(1).join(' ').trim();
  if (!team || !action) return null;
  if (/^[\d\W]+$/.test(team)) return null;
  return { team, action };
};

export const buildQuestionTemplates = (timeline: TimelineData[]): string[] => {
  if (!timeline || timeline.length === 0) return DEFAULT_QUESTION_TEMPLATES;

  const actionCounts = new Map<string, number>();
  const labelCounts = new Map<string, number>();
  const teamCounts = new Map<string, number>();
  const actionScores = new Map<string, number>();
  const markAction = (name: string, increment: number, teamHit: boolean) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    actionCounts.set(trimmed, (actionCounts.get(trimmed) ?? 0) + increment);
    const score =
      (actionScores.get(trimmed) ?? 0) + increment + (teamHit ? -0.5 : 0);
    actionScores.set(trimmed, score);
  };

  for (const item of timeline) {
    const actionName = item.actionName?.trim();
    if (actionName) {
      const parsed = splitTeamActionName(actionName);
      if (parsed?.team) {
        teamCounts.set(parsed.team, (teamCounts.get(parsed.team) ?? 0) + 1);
        if (parsed.action) {
          markAction(parsed.action, 1, true);
        }
      } else {
        markAction(actionName, 1, false);
      }
    }
    const labels = getLabelsFromTimelineData(item);
    for (const label of labels) {
      const key = label.name?.trim();
      if (!key) continue;
      labelCounts.set(key, (labelCounts.get(key) ?? 0) + 1);
    }
  }

  const topActions = Array.from(actionCounts.entries())
    .map(([name, count]) => ({
      name,
      count,
      score: actionScores.get(name) ?? count,
    }))
    .sort((a, b) => b.score - a.score || b.count - a.count)
    .map((entry) => entry.name)
    .filter((name) => !splitTeamActionName(name))
    .slice(0, 3);
  const topLabels = Array.from(labelCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name)
    .slice(0, 3);
  const topTeams = Array.from(teamCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name)
    .slice(0, 2);

  const templates: string[] = [];
  const add = (text: string) => {
    if (!templates.includes(text)) templates.push(text);
  };

  if (topActions[0]) {
    add(`${topActions[0]} が切り替わる前後の流れは？`);
    add(`${topActions[0]} の直前・直後に多い出来事は？`);
    add(`${topActions[0]} が起きやすい時間帯は？（前半/中盤/後半）`);
    add(`${topActions[0]} の結果に偏りはある？（成功/失敗など）`);
    if (topActions[1]) {
      add(`${topActions[1]} が切り替わる前後の流れは？`);
    }
  }
  if (topLabels[0]) {
    add(`「${topLabels[0]}」が起きやすい時間帯は？（前半/中盤/後半）`);
    add(`「${topLabels[0]}」の前後で多い出来事は？`);
  }
  if (topTeams.length >= 2) {
    add(`${topTeams[0]} と ${topTeams[1]} で【対象】の偏りは？`);
  } else if (topTeams[0]) {
    add(`${topTeams[0]} の【対象】傾向は？`);
  }

  if (templates.length < 4) {
    DEFAULT_QUESTION_TEMPLATES.forEach((template) => add(template));
  }

  return templates.slice(0, 6);
};

export const RETRIEVER_PRESETS: Array<{
  value: 'balanced' | 'labels' | 'memo' | 'time';
  label: string;
  helper: string;
}> = [
  { value: 'balanced', label: 'バランス', helper: '全体を均等に評価' },
  { value: 'labels', label: 'ラベル重視', helper: 'ラベル一致を重視' },
  { value: 'memo', label: 'メモ重視', helper: 'メモ一致を重視' },
  { value: 'time', label: '時間重視', helper: '時間条件を重視' },
];

export const RETRIEVER_WEIGHT_MAP: Record<
  (typeof RETRIEVER_PRESETS)[number]['value'],
  RetrieverWeights
> = {
  balanced: { token: 1, label: 1.6, memo: 1.1, time: 1.2, rareLabel: 0.6 },
  labels: { token: 0.9, label: 2.2, memo: 0.9, time: 1.1, rareLabel: 0.7 },
  memo: { token: 0.8, label: 1.2, memo: 2.0, time: 1.1, rareLabel: 0.7 },
  time: { token: 0.7, label: 1.1, memo: 0.9, time: 2.2, rareLabel: 0.7 },
};

export const resolveDiversifyTarget = (topK: number) => {
  if (topK <= 24) return Math.max(1, topK);
  return Math.min(30, Math.max(24, Math.floor(topK * 0.7)));
};

export const EVIDENCE_DEFAULT_VISIBLE_COUNT = 12;

export const parseNumberInput = (value: string): number | null => {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const mapEvidenceToTimeline = (items: EvidenceItem[]): TimelineData[] =>
  items.map((item) => ({
    id: item.id,
    actionName: item.actionName,
    startTime: item.startTime,
    endTime: item.endTime,
    memo: item.memo,
    labels: item.labels,
  }));

export const collectInsightEvidenceIds = (insight: EventInsights): string[] => {
  const ids = new Set<string>();
  insight.topStates.forEach((stat) =>
    stat.evidenceIds.forEach((id) => ids.add(id)),
  );
  insight.topTransitions.forEach((stat) =>
    stat.evidenceIds.forEach((id) => ids.add(id)),
  );
  insight.topSequences.forEach((stat) =>
    stat.evidenceIds.forEach((id) => ids.add(id)),
  );
  insight.streaks.forEach((stat) =>
    stat.evidenceIds.forEach((id) => ids.add(id)),
  );
  insight.rareStates.forEach((stat) =>
    stat.evidenceIds.forEach((id) => ids.add(id)),
  );
  insight.longestEvents.forEach((stat) =>
    stat.evidenceIds.forEach((id) => ids.add(id)),
  );
  return Array.from(ids);
};

export const collectFlowEvidenceIds = (insight: EventInsights): string[] => {
  const ids = new Set<string>();
  insight.topTransitions.forEach((stat) =>
    stat.evidenceIds.forEach((id) => ids.add(id)),
  );
  insight.topSequences.forEach((stat) =>
    stat.evidenceIds.forEach((id) => ids.add(id)),
  );
  if (insight.topSequencesByLength) {
    Object.values(insight.topSequencesByLength).forEach((stats) => {
      stats.forEach((stat) => stat.evidenceIds.forEach((id) => ids.add(id)));
    });
  }
  return Array.from(ids);
};

export const buildPlaylistName = () => {
  const now = new Date();
  const pad = (num: number) => num.toString().padStart(2, '0');
  const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
    now.getDate(),
  )} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  return `AI Review: ${timestamp}`;
};

export const normalizeEvidenceId = (value: string) => value.trim();

export type AvailableModelInfo = {
  name: string;
  path: string;
  sizeBytes: number;
  modifiedAt?: number;
};
