import { describe, expect, it } from 'vitest';
import {
  containsUnresolvedTeamPlaceholder,
  replaceTeamPlaceholderAliases,
  replaceTeamPlaceholdersWhenKnown,
} from './teamPlaceholder';

describe('teamPlaceholder', () => {
  it('keeps placeholders unresolved when team names are not known', () => {
    const result = replaceTeamPlaceholdersWhenKnown('${Team1} ポゼッション', {
      team1Name: '',
      team2Name: '',
    });

    expect(result).toBe('${Team1} ポゼッション');
    expect(containsUnresolvedTeamPlaceholder(result)).toBe(true);
  });

  it('maps saved Team1/Team2 aliases to actual team names when available', () => {
    expect(
      replaceTeamPlaceholderAliases('Team1 ポゼッション', {
        team1Name: '聖マリ',
        team2Name: '相手',
      }),
    ).toBe('聖マリ ポゼッション');
    expect(
      replaceTeamPlaceholderAliases('${Team2} ポゼッション', {
        team1Name: '聖マリ',
        team2Name: '相手',
      }),
    ).toBe('相手 ポゼッション');
  });
});
