/**
 * チーム名プレースホルダーの置換ユーティリティ
 *
 * ボタン名やアクション名に含まれる ${Team1}, ${Team2} を
 * 実際のチーム名に置換する
 */

/**
 * プレースホルダーの定義
 */
export const TEAM_PLACEHOLDERS = {
  TEAM1: '${Team1}',
  TEAM2: '${Team2}',
} as const;

/**
 * チーム名のコンテキスト
 */
export interface TeamContext {
  team1Name: string;
  team2Name: string;
}

/**
 * 文字列内のチーム名プレースホルダーを実際のチーム名に置換する
 *
 * @param text - 置換対象の文字列
 * @param context - チーム名のコンテキスト
 * @returns プレースホルダーが置換された文字列
 *
 * @example
 * replaceTeamPlaceholders('${Team1} タックル', { team1Name: 'Japan', team2Name: 'Australia' })
 * // => 'Japan タックル'
 */
export function replaceTeamPlaceholders(
  text: string,
  context: TeamContext,
): string {
  if (!text) return text;

  return text
    .replace(/\$\{Team1\}/g, context.team1Name || 'Team1')
    .replace(/\$\{Team2\}/g, context.team2Name || 'Team2');
}
