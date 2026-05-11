import type {
  ActionLink,
  ButtonLink,
  CodeWindowButton,
  CodeWindowLayout,
  HotkeyConfig,
  TeamArea,
} from './coreTypes';

export type UnknownRecord = Record<string, unknown>;

export type LegacyCodingPanel = UnknownRecord & {
  codeWindows?: unknown;
  layouts?: unknown;
  activeCodeWindowId?: unknown;
  activeLayoutId?: unknown;
};

export const isPlainObject = (value: unknown): value is UnknownRecord => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

export const asNonEmptyString = (value: unknown): string | undefined => {
  return typeof value === 'string' && value.trim() ? value : undefined;
};

export const asFiniteNumber = (value: unknown): number | undefined => {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
};

export const asPositiveNumber = (value: unknown): number | undefined => {
  const normalized = asFiniteNumber(value);
  return normalized != null && normalized > 0 ? normalized : undefined;
};

export const asBoolean = (value: unknown): boolean | undefined => {
  return typeof value === 'boolean' ? value : undefined;
};

export const cloneHotkey = (hotkey: HotkeyConfig): HotkeyConfig => ({
  ...hotkey,
});

const cloneButton = (button: CodeWindowButton): CodeWindowButton => ({
  ...button,
});

const cloneButtonLink = (link: ButtonLink): ButtonLink => ({
  ...link,
});

export const cloneActionLink = (link: ActionLink): ActionLink => ({
  ...link,
});

const cloneTeamArea = (area: TeamArea): TeamArea => ({
  ...area,
});

export const cloneCodeWindowLayout = (
  layout: CodeWindowLayout,
): CodeWindowLayout => ({
  ...layout,
  buttons: layout.buttons.map(cloneButton),
  ...(layout.buttonLinks
    ? { buttonLinks: layout.buttonLinks.map(cloneButtonLink) }
    : {}),
  ...(layout.team1Area ? { team1Area: cloneTeamArea(layout.team1Area) } : {}),
  ...(layout.team2Area ? { team2Area: cloneTeamArea(layout.team2Area) } : {}),
});
