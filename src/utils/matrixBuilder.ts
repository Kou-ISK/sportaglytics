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

/**
 * グループ軸の階層構造を構築するヘルパー
 */
const buildGroupAxisHeaders = (
  timeline: TimelineData[],
  groupName: string,
): {
  headers: Array<{ parent: string | null; child: string }>;
  parentSpans: Map<string, number>;
} => {
  const headers: Array<{ parent: string | null; child: string }> = [];
  const parentSpans = new Map<string, number>();
  const labels = extractUniqueLabelsForGroup(timeline, groupName);

  // labelsからgroupを抽出してグループ化
  const labelsByGroup = new Map<string, string[]>();

  for (const item of timeline) {
    const labelObj = item.labels?.find((l) => l.group === groupName);
    const labelName = labelObj?.name;
    const group = labelObj?.group;

    if (labelName && group) {
      if (!labelsByGroup.has(group)) {
        labelsByGroup.set(group, []);
      }
      const groupLabels = labelsByGroup.get(group);
      if (groupLabels && !groupLabels.includes(labelName)) {
        groupLabels.push(labelName);
      }
    }
  }

  // グループごとにラベルを配置
  if (labelsByGroup.size > 0) {
    const sortedGroups = Array.from(labelsByGroup.entries()).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    for (const [group, groupLabels] of sortedGroups) {
      const sortedLabels = [...groupLabels].sort((a, b) => a.localeCompare(b));
      parentSpans.set(group, sortedLabels.length);
      for (const label of sortedLabels) {
        headers.push({ parent: group, child: label });
      }
    }
  } else {
    // グループ情報がない場合は、ラベルのみ
    for (const label of labels) {
      headers.push({ parent: null, child: label });
    }
  }

  return { headers, parentSpans };
};

/**
 * アクション軸の階層構造を構築するヘルパー
 */
const buildActionAxisHeaders = (
  timeline: TimelineData[],
): {
  headers: Array<{ parent: string | null; child: string }>;
  parentSpans: Map<string, number>;
} => {
  const headers: Array<{ parent: string | null; child: string }> = [];
  const parentSpans = new Map<string, number>();
  const teams = extractUniqueTeams(timeline);

  for (const team of teams) {
    const actions = extractUniqueActionsForTeam(timeline, team);
    if (actions.length > 0) {
      parentSpans.set(team, actions.length);
      for (const action of actions) {
        headers.push({ parent: team, child: action });
      }
    }
  }

  return { headers, parentSpans };
};

/**
 * 階層構造を持つマトリクスを構築
 *
 * チーム→アクション、グループ→ラベルのような親子関係を持つマトリクスを構築します。
 *
 * @param timeline TimelineData配列
 * @param rowAxis 行軸の設定
 * @param columnAxis 列軸の設定
 * @returns 階層構造を持つマトリクスデータ
 */
export const buildHierarchicalMatrix = (
  timeline: TimelineData[],
  rowAxis: MatrixAxisConfig,
  columnAxis: MatrixAxisConfig,
): {
  matrix: MatrixCell[][];
  rowHeaders: Array<{ parent: string | null; child: string }>;
  columnHeaders: Array<{ parent: string | null; child: string }>;
  rowParentSpans: Map<string, number>;
  colParentSpans: Map<string, number>;
} => {
  // 行の階層構造を構築
  let rowHeaders: Array<{ parent: string | null; child: string }> = [];
  let rowParentSpans = new Map<string, number>();

  if (rowAxis.type === 'action') {
    const result = buildActionAxisHeaders(timeline);
    rowHeaders = result.headers;
    rowParentSpans = result.parentSpans;
  } else if (rowAxis.type === 'group' && rowAxis.value) {
    const result = buildGroupAxisHeaders(timeline, rowAxis.value);
    rowHeaders = result.headers;
    rowParentSpans = result.parentSpans;
  } else {
    const keys = extractKeysForAxis(timeline, rowAxis);
    for (const key of keys) {
      rowHeaders.push({ parent: null, child: key });
    }
  }

  // 列の階層構造を構築
  let columnHeaders: Array<{ parent: string | null; child: string }> = [];
  let colParentSpans = new Map<string, number>();

  if (columnAxis.type === 'action') {
    const result = buildActionAxisHeaders(timeline);
    columnHeaders = result.headers;
    colParentSpans = result.parentSpans;
  } else if (columnAxis.type === 'group' && columnAxis.value) {
    const result = buildGroupAxisHeaders(timeline, columnAxis.value);
    columnHeaders = result.headers;
    colParentSpans = result.parentSpans;
  } else {
    const keys = extractKeysForAxis(timeline, columnAxis);
    for (const key of keys) {
      columnHeaders.push({ parent: null, child: key });
    }
  }

  // マトリクスセルを初期化
  const matrix: MatrixCell[][] = rowHeaders.map(() =>
    columnHeaders.map(() => ({ count: 0, entries: [] })),
  );

  // データを集計
  for (const item of timeline) {
    const rowIndex = findHeaderIndex(item, rowAxis, rowHeaders);
    const colIndex = findHeaderIndex(item, columnAxis, columnHeaders);

    if (rowIndex >= 0 && colIndex >= 0) {
      const cell = matrix[rowIndex]?.[colIndex];
      if (cell) {
        cell.count += 1;
        cell.entries.push(item);
      }
    }
  }

  return { matrix, rowHeaders, columnHeaders, rowParentSpans, colParentSpans };
};

/**
 * ヘッダー配列から該当するインデックスを検索
 */
const findHeaderIndex = (
  item: TimelineData,
  axis: MatrixAxisConfig,
  headers: Array<{ parent: string | null; child: string }>,
): number => {
  if (axis.type === 'action') {
    const team = extractTeamFromActionName(item.actionName);
    const action = extractActionFromActionName(item.actionName);
    return headers.findIndex((h) => h.parent === team && h.child === action);
  }

  if (axis.type === 'group' && axis.value) {
    const label = getLabelByGroupWithFallback(item, axis.value, '');
    if (label) {
      return headers.findIndex((h) => h.child === label);
    }
    return -1;
  }

  const key = extractValueFromAxis(item, axis);
  return headers.findIndex((h) => h.child === key);
};
