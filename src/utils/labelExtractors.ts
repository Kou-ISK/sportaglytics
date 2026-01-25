import type { TimelineData } from '../types/TimelineData';
import type { SCLabel } from '../types/SCTimeline';

/**
 * TimelineDataからlabels配列を取得し、group別に分類
 * labels配列が存在しない場合は、actionType/actionResultから生成
 */
export const getLabelsFromTimelineData = (item: TimelineData): SCLabel[] => {
  const labels: SCLabel[] = item.labels ? [...item.labels] : [];

  // 後方互換性: labels配列が存在しない場合はactionType/actionResultから生成
  if (labels.length === 0) {
    if (item.actionType) {
      labels.push({ name: item.actionType, group: 'actionType' });
    }
    if (item.actionResult) {
      labels.push({ name: item.actionResult, group: 'actionResult' });
    }
    return labels;
  }

  // labels配列がある場合でも、actionType/actionResultが欠けていれば補完する
  const hasActionType = labels.some((label) => label.group === 'actionType');
  if (!hasActionType && item.actionType) {
    labels.push({ name: item.actionType, group: 'actionType' });
  }
  const hasActionResult = labels.some((label) => label.group === 'actionResult');
  if (!hasActionResult && item.actionResult) {
    labels.push({ name: item.actionResult, group: 'actionResult' });
  }

  return labels;
};

/**
 * TimelineDataから特定のgroupに属するラベル名を取得
 * 見つからない場合は undefined を返す
 */
export const getLabelByGroup = (
  item: TimelineData,
  group: string,
): string | undefined => {
  const labels = getLabelsFromTimelineData(item);
  const label = labels.find((l) => l.group === group);
  return label?.name;
};

/**
 * TimelineDataから特定のgroupに属するラベル名を取得（フォールバック付き）
 * 見つからない場合は fallback を返す
 */
export const getLabelByGroupWithFallback = (
  item: TimelineData,
  group: string,
  fallback: string = '未設定',
): string => {
  return getLabelByGroup(item, group) ?? fallback;
};

/**
 * TimelineData配列から特定のgroupに属する全てのユニークなラベル名を抽出
 * ソート済みで返す
 */
export const extractUniqueLabelsForGroup = (
  timeline: TimelineData[],
  group: string,
): string[] => {
  const labelSet = new Set<string>();

  for (const item of timeline) {
    const label = getLabelByGroup(item, group);
    if (label) {
      labelSet.add(label);
    }
  }

  return Array.from(labelSet).sort((a, b) => a.localeCompare(b));
};

/**
 * TimelineData配列から全てのユニークなgroup名を抽出
 * ソート済みで返す
 */
export const extractUniqueGroups = (timeline: TimelineData[]): string[] => {
  const groupSet = new Set<string>();

  for (const item of timeline) {
    const labels = getLabelsFromTimelineData(item);
    for (const label of labels) {
      if (label.group) {
        groupSet.add(label.group);
      }
    }
  }

  return Array.from(groupSet).sort((a, b) => a.localeCompare(b));
};

/**
 * TimelineData配列から team (actionNameの最初の単語) を抽出
 */
export const extractTeamFromActionName = (actionName: string): string => {
  const parts = actionName.split(' ');
  return parts[0] || '未設定';
};

/**
 * TimelineData配列から action (actionNameのteam部分を除いた残り) を抽出
 */
export const extractActionFromActionName = (actionName: string): string => {
  const parts = actionName.split(' ');
  return parts.slice(1).join(' ') || parts[0] || '未設定';
};

/**
 * TimelineData配列から全てのユニークなteam名を抽出
 * ソート済みで返す
 */
export const extractUniqueTeams = (timeline: TimelineData[]): string[] => {
  const teamSet = new Set<string>();

  for (const item of timeline) {
    const team = extractTeamFromActionName(item.actionName);
    teamSet.add(team);
  }

  return Array.from(teamSet).sort((a, b) => a.localeCompare(b));
};

/**
 * TimelineData配列から特定のteamに属する全てのユニークなaction名を抽出
 * ソート済みで返す
 */
export const extractUniqueActionsForTeam = (
  timeline: TimelineData[],
  team: string,
): string[] => {
  const actionSet = new Set<string>();

  for (const item of timeline) {
    const itemTeam = extractTeamFromActionName(item.actionName);
    if (itemTeam === team) {
      const action = extractActionFromActionName(item.actionName);
      actionSet.add(action);
    }
  }

  return Array.from(actionSet).sort((a, b) => a.localeCompare(b));
};
