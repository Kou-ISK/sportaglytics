import type { EvidenceFilters, EvidenceItem } from './types';

const truncateMemo = (memo: string, maxChars: number) => {
  if (memo.length <= maxChars) return memo;
  return `${memo.slice(0, maxChars)}…`;
};

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

  return [
    'あなたはスポーツ映像分析のAIレビュー・コパイロットです。',
    '以下の証拠(evidence)のみを根拠に回答し、証拠にない事実は述べないでください。',
    '出力は簡潔にしてください。summaryは2文以内、hypothesesは最大3件、evidenceHighlightsは最大5件、recommendedClipsは最大5件。',
    '必ずJSONのみを出力してください。',
    'スキーマ:',
    '{"summary":string,"hypotheses":[{"text":string,"evidenceIds":string[]}],"evidenceHighlights":[{"id":string,"why":string}],"recommendedClips":[{"title":string,"centerId":string,"preSeconds":number,"postSeconds":number,"reason":string,"evidenceIds":string[]}]}',
    '',
    `# 質問\n${params.question}`,
    '',
    `# フィルタ\n${formatFilters(params.filters)}`,
    '',
    '# evidence',
    evidenceLines || '(none)',
  ].join('\n');
};

export const buildRepairPrompt = (raw: string, errorMessage: string) => {
  return [
    '以下の出力はJSONスキーマに合致していません。',
    '必ずJSONのみを出力し、スキーマに従って修正してください。',
    'スキーマ:',
    '{"summary":string,"hypotheses":[{"text":string,"evidenceIds":string[]}],"evidenceHighlights":[{"id":string,"why":string}],"recommendedClips":[{"title":string,"centerId":string,"preSeconds":number,"postSeconds":number,"reason":string,"evidenceIds":string[]}]}',
    '',
    '# エラー理由',
    errorMessage,
    '',
    '# 元の出力',
    raw,
  ].join('\n');
};
