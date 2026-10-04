import type {
  TimelineData,
  TimelineDocument,
  TimelineRow,
} from '../../../../../../types/timeline/core';

export interface ParsedSportscodeXml {
  document: TimelineDocument;
  sessionStart: string | null;
  warnings: string[];
}

const children = (parent: Element, name: string): Element[] =>
  Array.from(parent.children).filter((child) => child.tagName === name);

const single = (
  parent: Element,
  name: string,
  required = false,
): string | null => {
  const matches = children(parent, name);
  if (matches.length > 1 || (required && matches.length !== 1))
    throw new Error(`XMLの ${name} が不足または重複しています。`);
  if (matches[0]?.children.length)
    throw new Error(`XMLの ${name} に未対応の入れ子があります。`);
  return matches[0]?.textContent ?? null;
};

const numberValue = (value: string | null, name: string): number => {
  if (value === null || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value.trim()))
    throw new Error(`XMLの ${name} が数値ではありません。`);
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`XMLの ${name} が不正です。`);
  return number;
};

const requiredText = (parent: Element, name: string): string => {
  const value = single(parent, name, true);
  if (!value?.trim()) throw new Error(`XMLの ${name} が空です。`);
  return value;
};

const colorChannel = (parent: Element, name: string): string => {
  const number = numberValue(single(parent, name, true), name);
  if (!Number.isInteger(number) || number < 0 || number > 65535)
    throw new Error('XMLの行色は0〜65535の整数で指定してください。');
  return Math.round((number / 65535) * 255)
    .toString(16)
    .padStart(2, '0');
};

/** Official XML edit-list subset; native packages and loose/malformed XML are not guessed. */
export const parseSportscodeXml = (
  text: string,
  offsetSeconds: number,
): ParsedSportscodeXml => {
  if (new TextEncoder().encode(text).byteLength > 16 * 1024 * 1024)
    throw new Error('XMLは16MiB以下にしてください。');
  if (!Number.isFinite(offsetSeconds) || Math.abs(offsetSeconds) > 86400)
    throw new Error('時刻の補正は±86400秒以内で指定してください。');
  if (/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(text))
    throw new Error('外部参照や実体宣言を含むXMLには対応していません。');
  const xml = new DOMParser().parseFromString(text, 'application/xml');
  if (xml.querySelector('parsererror'))
    throw new Error(
      'XMLを解析できません。Sportscodeから整形式のXMLを書き出してください。',
    );
  const root = xml.documentElement;
  if (root.tagName !== 'file' || root.namespaceURI)
    throw new Error('Sportscode XML edit list の file 形式ではありません。');
  for (const element of [root, ...Array.from(root.getElementsByTagName('*'))]) {
    if (element.namespaceURI || element.attributes.length)
      throw new Error('未対応の属性・バージョン・名前空間を含むXMLです。');
  }
  const warnings = new Set<string>();
  const inspectFields = (parent: Element, allowed: string[]): void => {
    if (parent.attributes.length)
      throw new Error('未対応の属性・バージョンを含むXMLです。');
    for (const child of Array.from(parent.children)) {
      if (child.namespaceURI)
        throw new Error('名前空間付きXMLには対応していません。');
      if (!allowed.includes(child.tagName))
        warnings.add(`未対応の項目 ${child.tagName} は読み込みません。`);
    }
  };
  inspectFields(root, ['SESSION_INFO', 'SORT_INFO', 'ALL_INSTANCES', 'ROWS']);
  const sections = (name: string, required = false): Element | null => {
    const matches = children(root, name);
    if (matches.length > 1 || (required && matches.length !== 1))
      throw new Error(`XMLの ${name} が不足または重複しています。`);
    return matches[0] ?? null;
  };
  const session = sections('SESSION_INFO');
  if (session) inspectFields(session, ['start_time']);
  const sessionStart = session ? single(session, 'start_time') : null;
  if (sessionStart)
    warnings.add(
      'SESSION_INFOの開始日時は自動補正しません。選んだ映像との秒数補正を確認してください。',
    );
  const rowsSection = sections('ROWS');
  const sortedRows: Array<{ row: TimelineRow; order: number }> = [];
  if (rowsSection) {
    inspectFields(rowsSection, ['row']);
    for (const [index, row] of children(rowsSection, 'row').entries()) {
      inspectFields(row, ['code', 'sort_order', 'R', 'G', 'B']);
      const name = requiredText(row, 'code');
      if (sortedRows.some((item) => item.row.name === name))
        throw new Error('XMLの行名が重複しています。');
      const channels = ['R', 'G', 'B'].map((channel) => single(row, channel));
      if (
        channels.some((channel) => channel !== null) &&
        channels.some((channel) => channel === null)
      )
        throw new Error('XMLの行色にはR・G・Bが必要です。');
      sortedRows.push({
        row: {
          id: `sportscode-row-${index + 1}`,
          name,
          color:
            channels[0] === null
              ? '#4D8DFF'
              : `#${['R', 'G', 'B'].map((channel) => colorChannel(row, channel)).join('')}`,
        },
        order:
          single(row, 'sort_order') === null
            ? index + 1
            : numberValue(single(row, 'sort_order'), 'sort_order'),
      });
    }
  }
  const sortInfo = sections('SORT_INFO');
  if (sortInfo) inspectFields(sortInfo, ['sort_type']);
  const sortType = sortInfo ? single(sortInfo, 'sort_type') : null;
  if (sortType === 'sort order') sortedRows.sort((a, b) => a.order - b.order);
  else if (sortType === 'name')
    sortedRows.sort((a, b) => a.row.name.localeCompare(b.row.name));
  else if (sortType)
    warnings.add(`並び順 ${sortType} はXML内の行順で読み込みます。`);
  const instanceSection = sections('ALL_INSTANCES', true);
  if (!instanceSection) throw new Error('XMLに場面一覧がありません。');
  inspectFields(instanceSection, ['instance']);
  const instances: TimelineData[] = [];
  const ids = new Set<string>();
  for (const instance of children(instanceSection, 'instance')) {
    inspectFields(instance, [
      'ID',
      'start',
      'end',
      'code',
      'label',
      'free_text',
    ]);
    const sourceId = requiredText(instance, 'ID').trim();
    if (!/^\d{1,64}$/.test(sourceId))
      throw new Error('XMLのIDは整数で指定してください。');
    const canonicalId = BigInt(sourceId).toString();
    if (ids.has(canonicalId)) throw new Error('XMLの場面IDが重複しています。');
    ids.add(canonicalId);
    const startTime =
      numberValue(single(instance, 'start', true), 'start') + offsetSeconds;
    const endTime =
      numberValue(single(instance, 'end', true), 'end') + offsetSeconds;
    if (startTime < 0 || endTime < startTime || endTime > 86400)
      throw new Error(
        '補正後の時刻が負、逆順、または24時間を超えています。切り詰めずに中止しました。',
      );
    const actionName = requiredText(instance, 'code');
    const labels = children(instance, 'label').map((label) => {
      inspectFields(label, ['text', 'group']);
      const name = requiredText(label, 'text');
      const group = single(label, 'group');
      return group === null ? { name } : { name, group };
    });
    if (!sortedRows.some((item) => item.row.name === actionName))
      sortedRows.push({
        row: {
          id: `sportscode-row-${sortedRows.length + 1}`,
          name: actionName,
          color: '#4D8DFF',
        },
        order: sortedRows.length + 1,
      });
    instances.push({
      id: `sportscode-${canonicalId}`,
      actionName,
      startTime,
      endTime,
      memo: single(instance, 'free_text') ?? '',
      labels,
    });
  }
  if (!instances.length)
    warnings.add('XMLに場面がありません。空のタイムラインを作成します。');
  return {
    document: {
      version: 2,
      rows: sortedRows.map((item) => item.row),
      instances,
    },
    sessionStart,
    warnings: [...warnings],
  };
};
