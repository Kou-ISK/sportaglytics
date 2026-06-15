import type { TimelineData } from '../types/timeline/core';
import type { MatrixAxisConfig, MatrixCell } from '../types/analysis/matrix';
import {
  getLabelByGroupWithFallback,
  getLabelsFromTimelineData,
  extractTeamFromActionName,
  extractActionFromActionName,
  extractUniqueLabelsForGroup,
  extractUniqueTeams,
  extractUniqueActionsForTeam,
} from './labelExtractors';

const UNSET_LABEL = '未設定';

/**
 * MatrixAxisConfigに基づいて、TimelineDataから値を抽出
 */
const extractValueFromAxis = (
  item: TimelineData,
  axis: MatrixAxisConfig,
  fallback: string = UNSET_LABEL,
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
const extractKeysForAxis = (
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

  // 'all_labels'の場合は全グループのラベルを表示
  if (groupName === 'all_labels') {
    const labelsByGroup = new Map<string, Set<string>>();

    for (const item of timeline) {
      const labels = getLabelsFromTimelineData(item);
      if (labels.length === 0) {
        if (!labelsByGroup.has(UNSET_LABEL)) {
          labelsByGroup.set(UNSET_LABEL, new Set());
        }
        labelsByGroup.get(UNSET_LABEL)?.add(UNSET_LABEL);
        continue;
      }

      for (const label of labels) {
        if (label.group && label.name) {
          if (!labelsByGroup.has(label.group)) {
            labelsByGroup.set(label.group, new Set());
          }
          labelsByGroup.get(label.group)?.add(label.name);
        }
      }
    }

    // グループごとにラベルを配置
    const sortedGroups = Array.from(labelsByGroup.entries()).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    for (const [group, labelSet] of sortedGroups) {
      const sortedLabels = Array.from(labelSet).sort((a, b) =>
        a.localeCompare(b),
      );
      parentSpans.set(group, sortedLabels.length);
      for (const labelName of sortedLabels) {
        headers.push({ parent: group, child: labelName });
      }
    }

    return { headers, parentSpans };
  }

  // 特定のグループの場合
  const labels = extractUniqueLabelsForGroup(timeline, groupName);
  const hasUnset = timeline.some(
    (item) => getLabelByGroupWithFallback(item, groupName, '') === '',
  );
  const axisLabels = hasUnset ? [...labels, UNSET_LABEL] : labels;

  // labelsからgroupを抽出してグループ化
  const labelsByGroup = new Map<string, string[]>();

  for (const item of timeline) {
    const labelName = getLabelByGroupWithFallback(item, groupName, '');
    const group = labelName ? groupName : UNSET_LABEL;

    if (labelName) {
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
    for (const label of axisLabels) {
      headers.push({ parent: null, child: label });
    }
  }

  if (hasUnset && !headers.some((header) => header.child === UNSET_LABEL)) {
    headers.push({ parent: UNSET_LABEL, child: UNSET_LABEL });
    parentSpans.set(UNSET_LABEL, 1);
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
 * アクション軸をフラットに構築するヘルパー
 */
const buildFlatActionAxisHeaders = (
  timeline: TimelineData[],
): {
  headers: Array<{ parent: string | null; child: string }>;
  parentSpans: Map<string, number>;
} => {
  const headers: Array<{ parent: string | null; child: string }> = [];
  const actions = extractKeysForAxis(timeline, { type: 'action' });
  for (const action of actions) {
    headers.push({ parent: null, child: action });
  }
  return { headers, parentSpans: new Map<string, number>() };
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
    const result =
      columnAxis.type === 'team'
        ? buildFlatActionAxisHeaders(timeline)
        : buildActionAxisHeaders(timeline);
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
    const result =
      rowAxis.type === 'team'
        ? buildFlatActionAxisHeaders(timeline)
        : buildActionAxisHeaders(timeline);
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
    // all_labelsの場合は、全てのラベルの組み合わせでセルに追加
    const rowIndices = findAllHeaderIndices(item, rowAxis, rowHeaders);
    const colIndices = findAllHeaderIndices(item, columnAxis, columnHeaders);

    for (const rowIndex of rowIndices) {
      for (const colIndex of colIndices) {
        if (rowIndex >= 0 && colIndex >= 0) {
          const cell = matrix[rowIndex]?.[colIndex];
          if (cell) {
            cell.count += 1;
            cell.entries.push(item);
          }
        }
      }
    }
  }

  return { matrix, rowHeaders, columnHeaders, rowParentSpans, colParentSpans };
};

/**
 * ヘッダー配列から該当する全てのインデックスを検索（all_labels対応）
 */
const findAllHeaderIndices = (
  item: TimelineData,
  axis: MatrixAxisConfig,
  headers: Array<{ parent: string | null; child: string }>,
): number[] => {
  if (axis.type === 'action') {
    const team = extractTeamFromActionName(item.actionName);
    const action = extractActionFromActionName(item.actionName);
    const hasParent = headers.some((h) => h.parent !== null);
    const index = headers.findIndex((h) =>
      hasParent ? h.parent === team && h.child === action : h.child === action,
    );
    return index >= 0 ? [index] : [];
  }

  if (axis.type === 'group' && axis.value) {
    // 'all_labels'の場合は、item内の全ラベルから一致するものを全て取得
    if (axis.value === 'all_labels') {
      const indices: number[] = [];
      const labels = getLabelsFromTimelineData(item);
      if (labels.length === 0) {
        const index = headers.findIndex(
          (h) => h.parent === UNSET_LABEL && h.child === UNSET_LABEL,
        );
        return index >= 0 ? [index] : [];
      }
      for (const label of labels) {
        const index = headers.findIndex(
          (h) => h.parent === label.group && h.child === label.name,
        );
        if (index >= 0 && !indices.includes(index)) {
          indices.push(index);
        }
      }
      return indices;
    }

    // 特定のグループの場合
    const label = getLabelByGroupWithFallback(item, axis.value, UNSET_LABEL);
    const index = headers.findIndex((h) => h.child === label);
    return index >= 0 ? [index] : [];
  }

  const key = extractValueFromAxis(item, axis);
  const index = headers.findIndex((h) => h.child === key);
  return index >= 0 ? [index] : [];
};
