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

/**
 * 文字列にチーム名プレースホルダーが含まれているかチェック
 *
 * @param text - チェック対象の文字列
 * @returns プレースホルダーが含まれていればtrue
 */
export function hasTeamPlaceholder(text: string): boolean {
  if (!text) return false;
  return (
    text.includes(TEAM_PLACEHOLDERS.TEAM1) ||
    text.includes(TEAM_PLACEHOLDERS.TEAM2)
  );
}

/**
 * プレースホルダーからチーム番号を抽出
 * クロス集計でチーム軸として使用する際に利用
 *
 * @param text - チェック対象の文字列
 * @returns 'team1' | 'team2' | null
 */
export function extractTeamFromPlaceholder(
  text: string,
): 'team1' | 'team2' | null {
  if (!text) return null;
  if (text.includes(TEAM_PLACEHOLDERS.TEAM1)) return 'team1';
  if (text.includes(TEAM_PLACEHOLDERS.TEAM2)) return 'team2';
  return null;
}

/**
 * 記録されたアクション名からチーム情報を抽出
 * 実際のチーム名で記録された後、どのチームのアクションかを判定
 *
 * @param actionName - 記録されたアクション名
 * @param context - チーム名のコンテキスト
 * @returns 'team1' | 'team2' | null
 */
export function extractTeamFromActionName(
  actionName: string,
  context: TeamContext,
): 'team1' | 'team2' | null {
  if (!actionName) return null;

  // チーム名がアクション名の先頭に含まれているかチェック
  if (context.team1Name && actionName.startsWith(context.team1Name + ' ')) {
    return 'team1';
  }
  if (context.team2Name && actionName.startsWith(context.team2Name + ' ')) {
    return 'team2';
  }

  return null;
}

/**
 * アクション名からチーム名部分を除去して純粋なアクション名を取得
 *
 * @param actionName - 記録されたアクション名
 * @param context - チーム名のコンテキスト
 * @returns 純粋なアクション名
 */
export function extractPureActionName(
  actionName: string,
  context: TeamContext,
): string {
  if (!actionName) return actionName;

  if (context.team1Name && actionName.startsWith(context.team1Name + ' ')) {
    return actionName.slice(context.team1Name.length + 1);
  }
  if (context.team2Name && actionName.startsWith(context.team2Name + ' ')) {
    return actionName.slice(context.team2Name.length + 1);
  }

  return actionName;
}
