import type { TimelineData } from '../types/TimelineData';
import type {
  SCTimelineFile,
  SCTimelineContent,
  SCRow,
  SCInstance,
  SCLabel,
} from '../types/SCTimeline';

type LegacyTimelineData = TimelineData & {
  actionType?: unknown;
  actionResult?: unknown;
};

const getLegacyTimelineLabel = (
  item: TimelineData,
  key: 'actionType' | 'actionResult',
): string | undefined => {
  const value = (item as LegacyTimelineData)[key];
  return typeof value === 'string' && value.trim() ? value : undefined;
};

/**
 * 簡易UUID生成関数（v4形式）
 */
const generateUUID = (): string => {
  const template = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';
  let result = '';
  for (const c of template) {
    if (c === 'x' || c === 'y') {
      const r = Math.trunc(Math.random() * 16);
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      result += v.toString(16);
    } else {
      result += c;
    }
  }
  return result;
};

/**
 * TimelineDataのlabels配列から特定のgroupに属するラベルを取得
 */
const getLabelByGroup = (
  labels: SCLabel[] | undefined,
  group: string,
): string | undefined => {
  if (!labels || labels.length === 0) return undefined;
  const label = labels.find((l) => l.group === group);
  return label?.name;
};

/**
 * TimelineDataから必要なラベル情報を抽出または生成
 */
const extractLabelsFromTimelineData = (
  item: TimelineData,
): { actionType: string; actionResult: string; labels: SCLabel[] } => {
  const legacyActionType = getLegacyTimelineLabel(item, 'actionType');
  const legacyActionResult = getLegacyTimelineLabel(item, 'actionResult');

  // labels配列が存在する場合はそこから抽出
  if (item.labels && item.labels.length > 0) {
    const actionType = getLabelByGroup(item.labels, 'actionType') || legacyActionType || '';
    const actionResult = getLabelByGroup(item.labels, 'actionResult') || legacyActionResult || '';
    return { actionType, actionResult, labels: item.labels };
  }

  // labels配列が存在しない場合は従来のフィールドから生成
  const labels: SCLabel[] = [];
  if (legacyActionType) {
    labels.push({ name: legacyActionType, group: 'actionType' });
  }
  if (legacyActionResult) {
    labels.push({ name: legacyActionResult, group: 'actionResult' });
  }

  return {
    actionType: legacyActionType || '',
    actionResult: legacyActionResult || '',
    labels,
  };
};

/**
 * TimelineData配列をSCTimeline形式に変換
 *
 * SporTagLyticsのTimelineData配列を、Sportscode SCTimeline形式のJSONに変換します。
 * 各TimelineDataは個別のインスタンスとして、actionName別の行に振り分けられます。
 */
export const convertToSCTimeline = (
  timelineData: TimelineData[],
  packagePath: string = '',
): SCTimelineFile => {
  // actionName別にグループ化
  const rowMap = new Map<string, TimelineData[]>();

  for (const item of timelineData) {
    const actionName = item.actionName || 'Unknown';
    if (!rowMap.has(actionName)) {
      rowMap.set(actionName, []);
    }
    rowMap.get(actionName)!.push(item);
  }

  // 行を生成
  const rows: SCRow[] = [];
  let rowNum = 1;

  for (const [actionName, items] of rowMap.entries()) {
    // インスタンスを生成
    const instances: SCInstance[] = items.map((item, index) => {
      const { labels } = extractLabelsFromTimelineData(item);

      return {
        uniqueId: item.id,
        instanceNum: index + 1,
        modifyCount: 1,
        startTime: item.startTime,
        endTime: item.endTime,
        notes: item.memo || '',
        sharing: true,
        labels: labels.map((l) => ({
          name: l.name,
          group: l.group,
        })),
      };
    });

    // 行を追加
    rows.push({
      rowNum,
      modifyCount: 1,
      name: actionName,
      uniqueId: generateUUID(),
      color: generateColorForAction(actionName),
      instances,
    });

    rowNum++;
  }

  // SCTimeline形式のファイル構造を生成
  const timeline: SCTimelineContent = {
    packagePath,
    uniqueId: generateUUID(),
    currentModifyCount: 1,
    labels: [],
    rows,
  };

  return {
    timeline,
  };
};

/**
 * SCTimeline形式からTimelineData配列に変換
 *
 * Sportscode SCTimeline形式のJSONを、SporTagLyticsのTimelineData配列に変換します。
 * labels配列中心の TimelineData に変換します。
 */
export const convertFromSCTimeline = (
  scTimeline: SCTimelineFile,
): TimelineData[] => {
  const timelineData: TimelineData[] = [];

  for (const row of scTimeline.timeline.rows) {
    for (const instance of row.instances) {
      // labels配列から actionType と actionResult を抽出
      const actionTypeLabel = instance.labels.find(
        (l) => l.group === 'actionType',
      );
      const actionResultLabel = instance.labels.find(
        (l) => l.group === 'actionResult',
      );

      // TimelineDataに変換
      const item: TimelineData = {
        id: instance.uniqueId,
        actionName: row.name,
        startTime: instance.startTime,
        endTime: instance.endTime,
        memo: instance.notes,
        // labels配列をそのまま保持（SCTimeline形式互換）
        labels: [
          ...instance.labels.map((l) => ({
            name: l.name,
            group: l.group,
          })),
          ...(actionTypeLabel
            ? [{ name: actionTypeLabel.name, group: 'actionType' as const }]
            : []),
          ...(actionResultLabel
            ? [{ name: actionResultLabel.name, group: 'actionResult' as const }]
            : []),
        ],
      };

      timelineData.push(item);
    }
  }

  // startTime順にソート
  timelineData.sort((a, b) => a.startTime - b.startTime);

  return timelineData;
};

/**
 * TimelineDataの正規化
 *
 * labels配列が存在しない古い形式のTimelineDataに対して、
 * actionType/actionResultからlabels配列を生成します。
 */
export const normalizeTimelineData = (data: unknown): TimelineData => {
  const raw = data as TimelineData & {
    actionType?: unknown;
    actionResult?: unknown;
    labels?: unknown;
    id?: unknown;
    actionName?: unknown;
    startTime?: unknown;
    endTime?: unknown;
    memo?: unknown;
    color?: unknown;
  };

  const normalizedLabels: SCLabel[] = Array.isArray(raw.labels)
    ? raw.labels.reduce<SCLabel[]>((acc, label) => {
        if (!label || typeof label !== 'object') return acc;
        const name = (label as { name?: unknown }).name;
        const group = (label as { group?: unknown }).group;
        if (typeof name !== 'string') return acc;
        if (typeof group === 'string') {
          acc.push({ name, group });
        } else {
          acc.push({ name });
        }
        return acc;
      }, [])
    : [];

  const legacyActionType =
    typeof raw.actionType === 'string' && raw.actionType.trim()
      ? raw.actionType
      : undefined;
  const legacyActionResult =
    typeof raw.actionResult === 'string' && raw.actionResult.trim()
      ? raw.actionResult
      : undefined;

  if (!normalizedLabels.some((label) => label.group === 'actionType') && legacyActionType) {
    normalizedLabels.push({ name: legacyActionType, group: 'actionType' });
  }
  if (!normalizedLabels.some((label) => label.group === 'actionResult') && legacyActionResult) {
    normalizedLabels.push({ name: legacyActionResult, group: 'actionResult' });
  }

  return {
    id: typeof raw.id === 'string' ? raw.id : generateUUID(),
    actionName: typeof raw.actionName === 'string' ? raw.actionName : '',
    startTime:
      typeof raw.startTime === 'number' && Number.isFinite(raw.startTime)
        ? raw.startTime
        : 0,
    endTime:
      typeof raw.endTime === 'number' && Number.isFinite(raw.endTime)
        ? raw.endTime
        : 0,
    memo: typeof raw.memo === 'string' ? raw.memo : '',
    labels: normalizedLabels,
    ...(typeof raw.color === 'string' ? { color: raw.color } : {}),
  };
};

/**
 * アクション名に基づいて色を生成
 * SCTimelineでは各行に色が設定されているため、一貫性のある色を生成
 */
const generateColorForAction = (actionName: string): string => {
  // デフォルトのカラーパレット（Sportscodeっぽい色）
  const colors = [
    '#E9E9E9', // グレー
    '#3890E0', // 青
    '#E03838', // 赤
    '#38E090', // 緑
    '#E0A838', // オレンジ
    '#9038E0', // 紫
    '#E03890', // ピンク
    '#38E0E0', // シアン
  ];

  // actionNameのハッシュ値を計算して色を選択
  let hash = 0;
  for (let i = 0; i < actionName.length; i++) {
    const code = actionName.codePointAt(i) ?? 0;
    hash = (hash << 5) - hash + code;
    hash = hash & hash; // 32bit整数に変換
  }

  const colorIndex = Math.abs(hash) % colors.length;
  return colors[colorIndex];
};
