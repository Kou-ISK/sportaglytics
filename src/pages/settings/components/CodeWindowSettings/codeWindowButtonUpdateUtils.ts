import type { CodeWindowButton } from '../../../../types/Settings';

type UpdatableKey =
  | 'color'
  | 'textColor'
  | 'borderRadius'
  | 'textAlign'
  | 'width'
  | 'height'
  | 'x'
  | 'y'
  | 'fontSize'
  | 'hotkey'
  | 'name'
  | 'labelValue'
  | 'team';

const UPDATABLE_KEYS: UpdatableKey[] = [
  'color',
  'textColor',
  'borderRadius',
  'textAlign',
  'width',
  'height',
  'x',
  'y',
  'fontSize',
  'hotkey',
  'name',
  'labelValue',
  'team',
];

export const buildSelectionButtonUpdates = (
  previous: CodeWindowButton,
  next: CodeWindowButton,
): Partial<CodeWindowButton> => {
  const updates: Partial<Pick<CodeWindowButton, UpdatableKey>> = {};
  UPDATABLE_KEYS.forEach((key) => {
    const nextValue = next[key];
    const prevValue = previous[key];
    if (nextValue === undefined || nextValue === prevValue) {
      return;
    }
    (updates as Record<string, unknown>)[key] = nextValue;
  });
  return updates;
};
