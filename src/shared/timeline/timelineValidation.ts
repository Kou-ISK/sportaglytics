const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isText = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;
const isTime = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

/** Reject unknown documents before normalization can turn them into empty data. */
export const validateTimelineDocumentData = (value: unknown): void => {
  const document = isRecord(value) ? value : null;
  if (!Array.isArray(value) && document?.version !== 2)
    throw new Error(
      '対応していないタイムライン形式・バージョンです。原本は変更していません。',
    );
  const items = Array.isArray(value) ? value : document?.instances;
  if (!Array.isArray(items))
    throw new Error('タイムラインの場面一覧が不正です。');
  const ids = new Set<string>();
  for (const item of items) {
    if (
      !isRecord(item) ||
      !isText(item.id) ||
      !isText(item.actionName) ||
      !isTime(item.startTime) ||
      !isTime(item.endTime) ||
      item.endTime < item.startTime ||
      (item.memo !== undefined && typeof item.memo !== 'string') ||
      (item.color !== undefined && typeof item.color !== 'string') ||
      (item.labels !== undefined &&
        (!Array.isArray(item.labels) ||
          !item.labels.every(
            (label: unknown) =>
              isRecord(label) &&
              typeof label.name === 'string' &&
              (label.group === undefined || typeof label.group === 'string'),
          )))
    )
      throw new Error(
        'タイムラインの場面・時刻・ラベルが不正です。原本を確認してください。',
      );
    if (ids.has(item.id))
      throw new Error('タイムラインの場面IDが重複しています。');
    ids.add(item.id);
  }
  if (document) {
    if (!Array.isArray(document.rows))
      throw new Error('タイムラインの行一覧が不正です。');
    const rowIds = new Set<string>();
    const rowNames = new Set<string>();
    for (const row of document.rows) {
      if (
        !isRecord(row) ||
        !isText(row.id) ||
        !isText(row.name) ||
        typeof row.color !== 'string' ||
        rowIds.has(row.id) ||
        rowNames.has(row.name)
      )
        throw new Error('タイムラインの行名・ID・色が不正です。');
      rowIds.add(row.id);
      rowNames.add(row.name);
    }
  }
};
