import { ulid } from 'ulid';
import type {
  ButtonLink,
  CodeWindowButton,
  CodeWindowLayout,
} from '../../../../types/settings/coreTypes';

export interface CopiedCodeWindowSelection {
  buttons: CodeWindowButton[];
  links: ButtonLink[];
  bounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
}

export interface PastedCodeWindowSelection {
  layout: CodeWindowLayout;
  selectedButtonIds: string[];
}

interface PasteCopiedSelectionOptions {
  offsetX?: number;
  offsetY?: number;
  createId?: () => string;
}

const cloneButton = (button: CodeWindowButton): CodeWindowButton => ({
  ...button,
});

const cloneLink = (link: ButtonLink): ButtonLink => ({
  ...link,
});

export const copyCodeWindowSelection = (
  layout: CodeWindowLayout,
  selectedButtonIds: string[],
): CopiedCodeWindowSelection | null => {
  const selectedIdSet = new Set(selectedButtonIds);
  const buttons = layout.buttons
    .filter((button) => selectedIdSet.has(button.id))
    .map(cloneButton);
  if (buttons.length === 0) return null;

  const links = (layout.buttonLinks ?? [])
    .filter(
      (link) =>
        selectedIdSet.has(link.fromButtonId) && selectedIdSet.has(link.toButtonId),
    )
    .map(cloneLink);

  return {
    buttons,
    links,
    bounds: {
      minX: Math.min(...buttons.map((button) => button.x)),
      minY: Math.min(...buttons.map((button) => button.y)),
      maxX: Math.max(...buttons.map((button) => button.x + button.width)),
      maxY: Math.max(...buttons.map((button) => button.y + button.height)),
    },
  };
};

const clampGroupOffset = (
  requestedOffset: number,
  minimum: number,
  maximum: number,
  canvasExtent: number,
): number => {
  const minimumOffset = -minimum;
  const maximumOffset = canvasExtent - maximum;
  if (minimumOffset > maximumOffset) return 0;
  return Math.min(maximumOffset, Math.max(minimumOffset, requestedOffset));
};

export const pasteCodeWindowSelection = (
  layout: CodeWindowLayout,
  copied: CopiedCodeWindowSelection,
  options: PasteCopiedSelectionOptions = {},
): PastedCodeWindowSelection => {
  if (copied.buttons.length === 0) {
    return { layout, selectedButtonIds: [] };
  }

  const createId = options.createId ?? ulid;
  const offsetX = clampGroupOffset(
    options.offsetX ?? 20,
    copied.bounds.minX,
    copied.bounds.maxX,
    layout.canvasWidth,
  );
  const offsetY = clampGroupOffset(
    options.offsetY ?? 20,
    copied.bounds.minY,
    copied.bounds.maxY,
    layout.canvasHeight,
  );

  const idMap = new Map<string, string>();
  copied.buttons.forEach((button) => idMap.set(button.id, createId()));

  const pastedButtons = copied.buttons.map((button) => ({
    ...cloneButton(button),
    id: idMap.get(button.id) ?? createId(),
    x: button.x + offsetX,
    y: button.y + offsetY,
  }));

  const pastedLinks = copied.links.flatMap((link): ButtonLink[] => {
    const fromButtonId = idMap.get(link.fromButtonId);
    const toButtonId = idMap.get(link.toButtonId);
    if (!fromButtonId || !toButtonId) return [];
    return [
      {
        ...cloneLink(link),
        id: createId(),
        fromButtonId,
        toButtonId,
      },
    ];
  });

  return {
    layout: {
      ...layout,
      buttons: [...layout.buttons, ...pastedButtons],
      buttonLinks: [...(layout.buttonLinks ?? []), ...pastedLinks],
    },
    selectedButtonIds: pastedButtons.map((button) => button.id),
  };
};
