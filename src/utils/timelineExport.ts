import type { TimelineData } from '../types/TimelineData';

/**
 * 秒数をHH:mm:ss形式（1時間未満ならmm:ss）に変換
 */
export const formatTimeForExport = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

/**
 * タイムラインをJSON形式でエクスポート
 */
export const exportToJSON = (timeline: TimelineData[]): string => {
  return JSON.stringify(timeline, null, 2);
};

/**
 * タイムラインをCSV形式でエクスポート（YouTube用）
 */
export const exportToCSV = (timeline: TimelineData[]): string => {
  // ヘッダー行
  const headers = [
    '時刻',
    '終了時刻',
    'アクション名',
    'タイプ',
    '結果',
    '備考',
  ];
  const csvRows = [headers.join(',')];

  // データ行
  for (const item of timeline) {
    const row = [
      formatTimeForExport(item.startTime),
      formatTimeForExport(item.endTime),
      `"${item.actionName.replace(/"/g, '""')}"`, // CSVエスケープ
      `"${(item.actionType || '').replace(/"/g, '""')}"`,
      `"${(item.actionResult || '').replace(/"/g, '""')}"`,
      `"${(item.qualifier || '').replace(/"/g, '""')}"`,
    ];
    csvRows.push(row.join(','));
  }

  return csvRows.join('\n');
};

/**
 * JSONからタイムラインをインポート
 * 後方互換性: labels配列が存在しない古い形式も読み込み可能
 */
export const importFromJSON = (jsonString: string): TimelineData[] => {
  const parsed = JSON.parse(jsonString);

  if (!Array.isArray(parsed)) {
    throw new TypeError('Invalid JSON format: Expected an array');
  }

  // 型チェックとバリデーション
  const result: TimelineData[] = [];

  for (const item of parsed) {
    if (
      typeof item.id !== 'string' ||
      typeof item.actionName !== 'string' ||
      typeof item.startTime !== 'number' ||
      typeof item.endTime !== 'number' ||
      typeof item.actionResult !== 'string' ||
      typeof item.actionType !== 'string' ||
      typeof item.qualifier !== 'string'
    ) {
      throw new TypeError('Invalid timeline item format');
    }

    // labels配列が存在しない場合は、actionType/actionResultから生成
    const timelineItem: TimelineData = {
      ...item,
      labels: item.labels || [
        { name: item.actionType, group: 'actionType' },
        { name: item.actionResult, group: 'actionResult' },
      ],
    };

    result.push(timelineItem);
  }

  return result;
};
