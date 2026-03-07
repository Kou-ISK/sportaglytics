import type { AiInsightFacts } from './eventInsights.types';

export const detectAnalysisFocus = (
  question?: string,
  teamNames: string[] = [],
): AiInsightFacts['analysisFocus'] | undefined => {
  const text = (question ?? '').trim();
  if (!text) return undefined;
  const lowered = text.toLowerCase();
  const intents = new Set<string>();

  const hasTeamName = teamNames.some((team) =>
    team ? lowered.includes(team.toLowerCase()) : false,
  );
  if (
    hasTeamName ||
    /チーム|相手|自チーム|自分たち|どっち|どちら|ホーム|アウェイ/.test(lowered)
  ) {
    intents.add('team');
  }
  if (/流れ|つながり|連続|遷移|シーケンス|展開/.test(lowered)) {
    intents.add('flow');
  }
  if (/直前|直後|前後/.test(lowered)) {
    intents.add('context');
  }
  if (/前半|後半|中盤|序盤|終盤|時間|タイミング/.test(lowered)) {
    intents.add('phase');
  }
  if (
    /結果|成功|失敗|ミス|エラー|反則|ペナルティ|PK|得点|失点|ゴール|トライ/.test(
      lowered,
    )
  ) {
    intents.add('result');
  }
  if (/ボール|ポゼッション|保持/.test(lowered)) {
    intents.add('possession');
  }

  const priority: string[] = [];
  if (intents.has('team')) {
    priority.push('team', 'team-phase', 'team-result');
  }
  if (intents.has('context')) {
    priority.push('context');
  }
  if (intents.has('flow')) {
    priority.push('flow');
  }
  if (intents.has('phase')) {
    priority.push('phase');
  }
  if (intents.has('result')) {
    priority.push('team-result', 'result');
  }
  if (intents.has('possession')) {
    priority.push('action', 'duration');
  }

  return {
    intents: Array.from(intents),
    priority,
    notes: intents.size > 0 ? undefined : 'no-clear-intent',
  };
};
