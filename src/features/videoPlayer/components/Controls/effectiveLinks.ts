import { replaceTeamPlaceholders, type TeamContext } from '../../../../utils/teamPlaceholder';
import type { CodeWindowLayout } from '../../../../types/Settings';

type ActionLink = {
  from: string;
  to: string;
  type: 'exclusive' | 'deactivate' | 'activate';
};

export type EffectiveLink = {
  from: string;
  to: string;
  type: 'exclusive' | 'deactivate' | 'activate';
  fromId?: string;
  toId?: string;
};

const getButtonNameById = (
  layout: CodeWindowLayout | null,
  buttonId: string,
): string | null => {
  if (!layout) return null;
  const button = layout.buttons.find((b) => b.id === buttonId);
  return button?.name || null;
};

export const buildEffectiveLinks = (
  actionLinks: ActionLink[],
  customLayout: CodeWindowLayout | null,
  teamContext: TeamContext,
): EffectiveLink[] => {
  const links: EffectiveLink[] = [];

  actionLinks.forEach((link) => {
    links.push({
      from: replaceTeamPlaceholders(link.from, teamContext),
      to: replaceTeamPlaceholders(link.to, teamContext),
      type: link.type,
    });
  });

  if (customLayout?.buttonLinks) {
    customLayout.buttonLinks.forEach((link) => {
      const fromName = getButtonNameById(customLayout, link.fromButtonId);
      const toName = getButtonNameById(customLayout, link.toButtonId);
      if (fromName && toName && link.type !== 'sequence') {
        links.push({
          from: replaceTeamPlaceholders(fromName, teamContext),
          to: replaceTeamPlaceholders(toName, teamContext),
          type: link.type as 'exclusive' | 'deactivate' | 'activate',
          fromId: link.fromButtonId,
          toId: link.toButtonId,
        });
      }
    });
  }

  return links;
};
