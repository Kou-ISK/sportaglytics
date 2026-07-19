import { describe, expect, it } from 'vitest';
import type { EffectiveLink } from '../effectiveLinks';
import { resolveLinkEffects } from './codePanelLinkRules';

const isSameBaseActionName = (left: string, right: string): boolean => {
  const stripTeam = (value: string): string =>
    value.replace(/^(Team1|聖マリ) /, '');
  return stripTeam(left) === stripTeam(right);
};

describe('codePanelLinkRules', () => {
  it('uses button ids to resolve activate link direction when names share the same base action', () => {
    const links: EffectiveLink[] = [
      {
        from: '聖マリ ポゼッション',
        to: 'Team1 ポゼッション',
        type: 'activate',
        fromId: 'actual-team-button',
        toId: 'placeholder-button',
      },
    ];

    expect(
      resolveLinkEffects(
        links,
        'Team1 ポゼッション',
        isSameBaseActionName,
        'placeholder-button',
      ).activateTargets,
    ).toEqual([]);
    expect(
      resolveLinkEffects(
        links,
        '聖マリ ポゼッション',
        isSameBaseActionName,
        'actual-team-button',
      ).activateTargets,
    ).toEqual(['Team1 ポゼッション']);
  });
});
