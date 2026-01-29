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
}) => {
  const maxMemoChars = params.maxMemoChars ?? 120;
  const evidenceLines = params.evidence
    .map((item) => {
      const labels = item.labels
        .map((label) =>
          label.group ? `${label.group}:${label.name}` : label.name,
        )
        .join(', ');
      const memo = item.memo ? truncateMemo(item.memo, maxMemoChars) : '';
      return [
        `id:${item.id}`,
        `time:${item.startTime}-${item.endTime}`,
        `action:${item.actionName}`,
        `labels:${labels || '-'}`,
        `memo:${memo || '-'}`,
      ].join(' | ');
    })
    .join('\n');

  const factsText = (() => {
    if (!params.facts) return '(none)';
    try {
      const json = JSON.stringify(params.facts, null, 2);
      const maxChars = 4000;
      return json.length > maxChars ? `${json.slice(0, maxChars)}…` : json;
    } catch (_error) {
      return '(invalid)';
    }
  })();

  return [
    'あなたはスポーツ映像分析のAIレビュー・コパイロットです。',
    '以下の証拠(evidence)のみを根拠に回答し、証拠にない事実は述べないでください。',
    'insight_factsは傾向の参考情報です。数値や傾向を使う場合は必ず該当evidenceIdsを提示してください。',
    '出力は簡潔にしてください。summaryは2文以内、hypothesesは最大3件、evidenceHighlightsは最大5件、recommendedClipsは最大5件。',
    'evidenceIdsは各項目最大5件、IDはevidence一覧にあるものだけを使ってください。',
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
