import type { EffectiveLink } from '../effectiveLinks';

export interface LinkEffects {
  activateTargets: string[];
  exclusiveTargets: string[];
  deactivateTargets: string[];
}

const pushUnique = (items: string[], value: string): void => {
  if (!items.includes(value)) {
    items.push(value);
  }
};

export const isLinkRelatedToTarget = (
  link: EffectiveLink,
  targetName: string,
  isSameActionName: (a: string, b: string) => boolean,
  targetId?: string,
): boolean => {
  if (targetId && (link.fromId || link.toId)) {
    return link.fromId === targetId || link.toId === targetId;
  }
  return (
    isSameActionName(link.from, targetName) ||
    isSameActionName(link.to, targetName)
  );
};

export const findRelatedLinks = (
  links: EffectiveLink[],
  targetName: string,
  isSameActionName: (a: string, b: string) => boolean,
  targetId?: string,
): EffectiveLink[] => {
  return links.filter((link) =>
    isLinkRelatedToTarget(link, targetName, isSameActionName, targetId),
  );
};

export const resolveLinkEffects = (
  relatedLinks: EffectiveLink[],
  clickedName: string,
  isSameActionName: (a: string, b: string) => boolean,
): LinkEffects => {
  const effects: LinkEffects = {
    activateTargets: [],
    exclusiveTargets: [],
    deactivateTargets: [],
  };

  for (const link of relatedLinks) {
    if (link.type === 'activate' && isSameActionName(link.from, clickedName)) {
      pushUnique(effects.activateTargets, link.to);
      continue;
    }

    if (link.type === 'exclusive') {
      const counterpart = isSameActionName(link.from, clickedName)
        ? link.to
        : link.from;
      pushUnique(effects.exclusiveTargets, counterpart);
      continue;
    }

    if (link.type === 'deactivate' && isSameActionName(link.from, clickedName)) {
      pushUnique(effects.deactivateTargets, link.to);
    }
  }

  return effects;
};
