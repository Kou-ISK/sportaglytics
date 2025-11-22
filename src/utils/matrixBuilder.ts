import type { TimelineData } from '../types/TimelineData';
import type { MatrixAxisConfig, MatrixCell } from '../types/MatrixConfig';
import {
  getLabelByGroupWithFallback,
  extractTeamFromActionName,
  extractActionFromActionName,
  extractUniqueLabelsForGroup,
  extractUniqueTeams,
  extractUniqueActionsForTeam,
} from './labelExtractors';

/**
 * MatrixAxisConfigに基づいて、TimelineDataから値を抽出
 */
const extractValueFromAxis = (
  item: TimelineData,
  axis: MatrixAxisConfig,
  fallback: string = '未設定',
): string => {
  switch (axis.type) {
    case 'group':
      if (!axis.value) return fallback;
      return getLabelByGroupWithFallback(item, axis.value, fallback);
    case 'team':
      return extractTeamFromActionName(item.actionName);
    case 'action':
      return extractActionFromActionName(item.actionName);
    default:
      return fallback;
  }
};

/**
 * MatrixAxisConfigに基づいて、キー（軸の値）のリストを抽出
 */
export const extractKeysForAxis = (
  timeline: TimelineData[],
  axis: MatrixAxisConfig,
  teamFilter?: string,
): string[] => {
  switch (axis.type) {
    case 'group':
      if (!axis.value) return [];
      return extractUniqueLabelsForGroup(timeline, axis.value);
    case 'team':
      return extractUniqueTeams(timeline);
    case 'action': {
      if (teamFilter) {
        return extractUniqueActionsForTeam(timeline, teamFilter);
      }
      // teamFilterが指定されていない場合は、全teamのactionを抽出
      const teams = extractUniqueTeams(timeline);
      const actionSet = new Set<string>();
      for (const team of teams) {
        const actions = extractUniqueActionsForTeam(timeline, team);
        for (const action of actions) {
          actionSet.add(action);
        }
      }
      return Array.from(actionSet).sort((a, b) => a.localeCompare(b));
    }
    default:
      return [];
  }
};

/**
 * 汎用的なマトリクス構築関数
 *
 * @param timeline TimelineData配列
 * @param rowAxis 行軸の設定
 * @param columnAxis 列軸の設定
 * @param filter オプショナルなフィルタ関数
 * @returns MatrixCell二次元配列
 */
export const buildGenericMatrix = (
  timeline: TimelineData[],
  rowAxis: MatrixAxisConfig,
  columnAxis: MatrixAxisConfig,
  filter?: (item: TimelineData) => boolean,
): {
  matrix: MatrixCell[][];
  rowKeys: string[];
  columnKeys: string[];
} => {
  // フィルタ適用
  const filteredTimeline = filter ? timeline.filter(filter) : timeline;

  // 行・列のキーを抽出
  const rowKeys = extractKeysForAxis(filteredTimeline, rowAxis);
  const columnKeys = extractKeysForAxis(filteredTimeline, columnAxis);

  if (rowKeys.length === 0 || columnKeys.length === 0) {
    return { matrix: [], rowKeys: [], columnKeys: [] };
  }

  // キーのインデックスマップを作成
  const rowMap = new Map<string, number>();
  for (const [index, key] of rowKeys.entries()) {
    rowMap.set(key, index);
  }

  const colMap = new Map<string, number>();
  for (const [index, key] of columnKeys.entries()) {
    colMap.set(key, index);
  }

  // マトリクスセルを初期化
  const matrix: MatrixCell[][] = rowKeys.map(() =>
    columnKeys.map(() => ({ count: 0, entries: [] })),
  );

  // データを集計
  for (const item of filteredTimeline) {
    const rowKey = extractValueFromAxis(item, rowAxis);
    const colKey = extractValueFromAxis(item, columnAxis);

    const rowIndex = rowMap.get(rowKey);
    const colIndex = colMap.get(colKey);

    if (rowIndex === undefined || colIndex === undefined) {
      continue;
    }

    const cell = matrix[rowIndex]?.[colIndex];
    if (!cell) {
      continue;
    }

    cell.count += 1;
    cell.entries.push(item);
  }

  return { matrix, rowKeys, columnKeys };
};

/**
 * チーム別のマトリクスを構築
 *
 * @param timeline TimelineData配列
 * @param team チーム名
 * @param rowAxis 行軸の設定（通常は action）
 * @param columnAxis 列軸の設定（通常は group）
 * @returns MatrixCell二次元配列とキー
 */
export const buildMatrixForTeam = (
  timeline: TimelineData[],
  team: string,
  rowAxis: MatrixAxisConfig,
  columnAxis: MatrixAxisConfig,
): {
  matrix: MatrixCell[][];
  rowKeys: string[];
  columnKeys: string[];
} => {
  return buildGenericMatrix(timeline, rowAxis, columnAxis, (item) => {
    const itemTeam = extractTeamFromActionName(item.actionName);
    return itemTeam === team;
  });
};
