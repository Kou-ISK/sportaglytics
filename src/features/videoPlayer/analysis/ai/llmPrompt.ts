import type { EvidenceFilters, EvidenceItem } from './types';

const truncateMemo = (memo: string, maxChars: number) => {
  if (memo.length <= maxChars) return memo;
  return `${memo.slice(0, maxChars)}…`;
};

const FALLBACK_TEMPLATE = JSON.stringify(
  {
    summary: '不明',
    hypotheses: [],
    evidenceHighlights: [],
    recommendedClips: [],
  },
  null,
  2,
);

const formatFilters = (filters?: EvidenceFilters) => {
  if (!filters) return 'なし';
  const parts: string[] = [];
  if (filters.timeRange?.start != null || filters.timeRange?.end != null) {
    parts.push(
      `timeRange:${filters.timeRange?.start ?? '-'}-${filters.timeRange?.end ?? '-'}`,
    );
  }
  if (filters.labelFilters && filters.labelFilters.length > 0) {
    const labelText = filters.labelFilters
      .map((f) => `${f.group ?? '*'}:${f.name ?? '*'}`)
      .join(', ');
    parts.push(`labels:${labelText}`);
  }
  return parts.length > 0 ? parts.join(' | ') : 'なし';
};

export const buildAugmentedPrompt = (params: {
  question: string;
  evidence: EvidenceItem[];
  filters?: EvidenceFilters;
  maxMemoChars?: number;
  facts?: Record<string, unknown> | null;
  evidenceKeyMap?: Map<string, string>;
}) => {
  const maxMemoChars = params.maxMemoChars ?? 90;
  const evidenceLines = params.evidence
    .map((item) => {
      const key = params.evidenceKeyMap?.get(item.id) ?? '';
      const labels = item.labels.map((label) =>
        label.group ? `${label.group}:${label.name}` : label.name,
      );
      const memo = item.memo ? truncateMemo(item.memo, maxMemoChars) : '';
      return [
        key ? `key:${key}` : null,
        `time:${item.startTime}-${item.endTime}`,
        `action:${item.actionName}`,
        `labels:[${labels.join(', ')}]`,
        `memo:${memo || '-'}`,
      ]
        .filter(Boolean)
        .join(' | ');
    })
    .join('\n');

  const factsText = (() => {
    if (!params.facts) return '(none)';
    try {
      const json = JSON.stringify(params.facts, null, 2);
      const maxChars = 2400;
      return json.length > maxChars ? `${json.slice(0, maxChars)}…` : json;
    } catch (_error) {
      return '(invalid)';
    }
  })();
  const allowedEvidenceKeys = params.evidenceKeyMap
    ? Array.from(params.evidenceKeyMap.values())
    : [];
  const allowedEvidenceKeyText =
    allowedEvidenceKeys.length > 0 ? allowedEvidenceKeys.join(', ') : '(none)';

  return [
    'あなたはスポーツ映像分析のAIレビュー・コパイロットです。',
    '参照してよいのは insight_facts と evidence のみです。証拠にない事実は述べないでください。',
    '数値や傾向を述べる場合は、必ず該当する evidenceIds を提示してください。',
    'teamStats がある場合はチーム別傾向を必ず確認してください（evidenceIds必須）。teamStats.source が inferred の場合は「推定」として書いてください。',
    'hypotheses / recommendedClips は必ず evidenceIds を含め、断定せず「可能性」「示唆」「要映像確認」の語尾で書いてください。',
    'summary は summaryAnchors / analysisFocus / contextStats を優先して短く読みやすく（500文字以内）にし、2〜3文でまとめてください。断定しないでください。',
    'analysisFocus.priority がある場合は、その順で重要点を並べてください。analysisFocus.notes が no-clear-intent の場合は無理に偏りを主張しないでください。',
    '出力は簡潔にしてください。hypothesesは最大3件、evidenceHighlightsは最大5件、recommendedClipsは最大5件。',
    'evidenceIdsは各項目最大5件、allowed_evidence_keys にあるキーのみを使ってください。',
    'evidenceIdsは allowed_evidence_keys の短いキーを使ってください（例: e1, e2）。長いIDは禁止です。',
    'allowed_evidence_keys に含まれないキーは禁止です。不明な項目は空配列で構いません。',
    '必ずJSONのみを出力してください。コードブロックや説明文は出力しないでください。',
    'スキーマ:',
    '{"summary":string,"hypotheses":[{"text":string,"evidenceIds":string[]}],"evidenceHighlights":[{"id":string,"why":string}],"recommendedClips":[{"title":string,"centerId":string,"preSeconds":number,"postSeconds":number,"reason":string,"evidenceIds":string[]}]}',
    '',
    'JSONが難しい場合は、次のテンプレートをそのまま出力してください:',
    FALLBACK_TEMPLATE,
    '',
    `# 質問\n${params.question}`,
    '',
    `# フィルタ\n${formatFilters(params.filters)}`,
    '',
    '# insight_facts',
    factsText,
    '',
    '# allowed_evidence_keys',
    allowedEvidenceKeyText,
    '',
    '# evidence',
    evidenceLines || '(none)',
  ].join('\n');
};

export const buildRepairPrompt = (raw: string, errorMessage: string) => {
  const maxChars = 2000;
  const trimmedRaw = raw.length > maxChars ? raw.slice(0, maxChars) : raw;
  return [
    '以下の出力はJSONスキーマに合致していません。',
    '必ずJSONのみを出力し、スキーマに従って修正してください。',
    '説明文やコードブロックは禁止です。',
    'スキーマ:',
    '{"summary":string,"hypotheses":[{"text":string,"evidenceIds":string[]}],"evidenceHighlights":[{"id":string,"why":string}],"recommendedClips":[{"title":string,"centerId":string,"preSeconds":number,"postSeconds":number,"reason":string,"evidenceIds":string[]}]}',
    '',
    'JSONが難しい場合は、次のテンプレートをそのまま出力してください:',
    FALLBACK_TEMPLATE,
    '',
    '# エラー理由',
    errorMessage,
    '',
    '# 元の出力',
    trimmedRaw,
  ].join('\n');
};
