import type {
  ActionLink,
  AppSettings,
  ButtonLink,
  CodeWindowButton,
  CodeWindowLayout,
  TeamArea,
} from './coreTypes';
import {
  DEFAULT_SETTINGS,
  createDefaultCodeWindowLayout,
  createRugbyLabelsCodeWindowLayout,
} from './defaults';
import {
  asBoolean,
  asFiniteNumber,
  asNonEmptyString,
  asPositiveNumber,
  cloneActionLink,
  cloneCodeWindowLayout,
  isPlainObject,
  type LegacyCodingPanel,
} from './normalizerUtils';

const getDefaultCodingPanel = (): NonNullable<AppSettings['codingPanel']> => {
  const fallbackDefaultLayout = createDefaultCodeWindowLayout();
  const defaultPanel = DEFAULT_SETTINGS.codingPanel;

  return {
    defaultMode: defaultPanel?.defaultMode ?? 'code',
    toolbars: (defaultPanel?.toolbars ?? []).map((toolbar) => ({ ...toolbar })),
    actionLinks: (defaultPanel?.actionLinks ?? []).map(cloneActionLink),
    codeWindows: (defaultPanel?.codeWindows ?? [fallbackDefaultLayout]).map(
      cloneCodeWindowLayout,
    ),
    activeCodeWindowId:
      defaultPanel?.activeCodeWindowId ?? fallbackDefaultLayout.id,
  };
};

const normalizeTeamArea = (value: unknown): TeamArea | undefined => {
  if (!isPlainObject(value)) {
    return undefined;
  }

  const x = asFiniteNumber(value.x);
  const y = asFiniteNumber(value.y);
  const width = asPositiveNumber(value.width);
  const height = asPositiveNumber(value.height);

  if (x == null || y == null || width == null || height == null) {
    return undefined;
  }

  return {
    x,
    y,
    width,
    height,
  };
};

const normalizeButtonLinkType = (
  value: unknown,
): ButtonLink['type'] | undefined => {
  return value === 'exclusive' ||
    value === 'deactivate' ||
    value === 'activate' ||
    value === 'sequence'
    ? value
    : undefined;
};

const normalizeActionLinkType = (
  value: unknown,
): ActionLink['type'] | undefined => {
  return value === 'exclusive' || value === 'deactivate' || value === 'activate'
    ? value
    : undefined;
};

const normalizeCodeWindowButton = (value: unknown): CodeWindowButton | null => {
  if (!isPlainObject(value)) {
    return null;
  }

  const id = asNonEmptyString(value.id);
  const type =
    value.type === 'action' || value.type === 'label' ? value.type : undefined;
  const name = asNonEmptyString(value.name);
  const x = asFiniteNumber(value.x);
  const y = asFiniteNumber(value.y);
  const width = asPositiveNumber(value.width);
  const height = asPositiveNumber(value.height);

  if (!id || !type || !name || x == null || y == null || !width || !height) {
    return null;
  }

  const normalized: CodeWindowButton = {
    id,
    type,
    name,
    x,
    y,
    width,
    height,
  };

  const labelValue = asNonEmptyString(value.labelValue);
  if (labelValue) {
    normalized.labelValue = labelValue;
  }

  const color = asNonEmptyString(value.color);
  if (color) {
    normalized.color = color;
  }

  const textColor = asNonEmptyString(value.textColor);
  if (textColor) {
    normalized.textColor = textColor;
  }

  if (
    value.textAlign === 'left' ||
    value.textAlign === 'center' ||
    value.textAlign === 'right'
  ) {
    normalized.textAlign = value.textAlign;
  }

  const borderRadius = asFiniteNumber(value.borderRadius);
  if (borderRadius != null) {
    normalized.borderRadius = borderRadius;
  }

  const hotkey = asNonEmptyString(value.hotkey);
  if (hotkey) {
    normalized.hotkey = hotkey;
  }

  if (
    value.team === 'team1' ||
    value.team === 'team2' ||
    value.team === 'shared'
  ) {
    normalized.team = value.team;
  }

  const groupId = asNonEmptyString(value.groupId);
  if (groupId) {
    normalized.groupId = groupId;
  }

  const fontSize = asPositiveNumber(value.fontSize);
  if (fontSize != null) {
    normalized.fontSize = fontSize;
  }

  return normalized;
};

const normalizeButtonLink = (value: unknown): ButtonLink | null => {
  if (!isPlainObject(value)) {
    return null;
  }

  const id = asNonEmptyString(value.id);
  const fromButtonId = asNonEmptyString(value.fromButtonId);
  const toButtonId = asNonEmptyString(value.toButtonId);
  const type = normalizeButtonLinkType(value.type);

  if (!id || !fromButtonId || !toButtonId || !type) {
    return null;
  }

  return {
    id,
    fromButtonId,
    toButtonId,
    type,
  };
};

const normalizeActionLink = (value: unknown): ActionLink | null => {
  if (!isPlainObject(value)) {
    return null;
  }

  const id = asNonEmptyString(value.id);
  const from = asNonEmptyString(value.from);
  const to = asNonEmptyString(value.to);
  const type = normalizeActionLinkType(value.type);

  if (!id || !from || !to || !type) {
    return null;
  }

  const description = asNonEmptyString(value.description);

  return {
    id,
    from,
    to,
    type,
    ...(description ? { description } : {}),
  };
};

const normalizeCodeWindowLayout = (
  value: unknown,
  index: number,
): CodeWindowLayout | null => {
  if (!isPlainObject(value)) {
    return null;
  }

  const canvasWidth = asPositiveNumber(value.canvasWidth);
  const canvasHeight = asPositiveNumber(value.canvasHeight);

  if (canvasWidth == null || canvasHeight == null) {
    return null;
  }

  const buttons = Array.isArray(value.buttons)
    ? value.buttons
        .map((button) => normalizeCodeWindowButton(button))
        .filter((button): button is CodeWindowButton => button !== null)
    : [];

  const normalized: CodeWindowLayout = {
    id: asNonEmptyString(value.id) ?? `code-window-${index + 1}`,
    name: asNonEmptyString(value.name) ?? `コードウィンドウ ${index + 1}`,
    canvasWidth,
    canvasHeight,
    buttons,
  };

  const buttonLinks = Array.isArray(value.buttonLinks)
    ? value.buttonLinks
        .map((link) => normalizeButtonLink(link))
        .filter((link): link is ButtonLink => link !== null)
    : [];
  if (buttonLinks.length > 0) {
    normalized.buttonLinks = buttonLinks;
  }

  const splitByTeam = asBoolean(value.splitByTeam);
  if (splitByTeam != null) {
    normalized.splitByTeam = splitByTeam;
  }

  const team1Area = normalizeTeamArea(value.team1Area);
  if (team1Area) {
    normalized.team1Area = team1Area;
  }

  const team2Area = normalizeTeamArea(value.team2Area);
  if (team2Area) {
    normalized.team2Area = team2Area;
  }

  return normalized;
};

export const normalizeCodingPanelLayouts = (
  panel: NonNullable<AppSettings['codingPanel']>,
): NonNullable<AppSettings['codingPanel']> => {
  const presetLayouts = [
    createDefaultCodeWindowLayout(),
    createRugbyLabelsCodeWindowLayout(),
  ];
  const defaultLayout = presetLayouts[0];
  const codeWindows = Array.isArray(panel.codeWindows)
    ? panel.codeWindows.map(cloneCodeWindowLayout)
    : [];

  presetLayouts.forEach((presetLayout, presetIndex) => {
    const idx = codeWindows.findIndex((layout) => layout.id === presetLayout.id);
    const shouldReplace =
      idx === -1 ||
      codeWindows[idx].canvasWidth !== presetLayout.canvasWidth ||
      codeWindows[idx].canvasHeight !== presetLayout.canvasHeight ||
      (codeWindows[idx].buttons?.length ?? 0) !== presetLayout.buttons.length;

    if (idx === -1) {
      codeWindows.splice(presetIndex, 0, presetLayout);
    } else if (shouldReplace) {
      codeWindows[idx] = presetLayout;
    }
  });

  const requestedActiveId = panel.activeCodeWindowId;
  const activeCodeWindowId = codeWindows.some(
    (layout) => layout.id === requestedActiveId,
  )
    ? requestedActiveId
    : defaultLayout?.id ?? 'default';

  return {
    ...panel,
    codeWindows,
    activeCodeWindowId,
  };
};

export const normalizeCodingPanel = (
  value: unknown,
): NonNullable<AppSettings['codingPanel']> => {
  const defaults = getDefaultCodingPanel();
  if (!isPlainObject(value)) {
    return normalizeCodingPanelLayouts(defaults);
  }

  const legacyPanel = value as LegacyCodingPanel;
  const rawCodeWindows: unknown[] = Array.isArray(legacyPanel.codeWindows)
    ? legacyPanel.codeWindows
    : Array.isArray(legacyPanel.layouts)
      ? legacyPanel.layouts
      : (defaults.codeWindows ?? []);
  const codeWindows = rawCodeWindows
    .map((layout, index) => normalizeCodeWindowLayout(layout, index))
    .filter((layout): layout is CodeWindowLayout => layout !== null);

  return normalizeCodingPanelLayouts({
    defaultMode:
      value.defaultMode === 'label' || value.defaultMode === 'code'
        ? value.defaultMode
        : defaults.defaultMode,
    toolbars: Array.isArray(value.toolbars)
      ? value.toolbars
          .filter(isPlainObject)
          .map((toolbar, index) => {
            const id = asNonEmptyString(toolbar.id) ?? `toolbar-${index + 1}`;
            const label =
              asNonEmptyString(toolbar.label) ?? `ツールバー ${index + 1}`;
            const mode =
              toolbar.mode === 'code' || toolbar.mode === 'label'
                ? toolbar.mode
                : null;
            const enabled = asBoolean(toolbar.enabled);

            if (mode == null || enabled == null) {
              return null;
            }

            return {
              id,
              label,
              mode,
              enabled,
              ...(toolbar.plugin === 'matrix' ||
              toolbar.plugin === 'script' ||
              toolbar.plugin === 'organizer'
                ? { plugin: toolbar.plugin }
                : {}),
            };
          })
          .filter(
            (
              toolbar,
            ): toolbar is NonNullable<
              AppSettings['codingPanel']
            >['toolbars'][number] => toolbar !== null,
          )
      : defaults.toolbars,
    actionLinks: Array.isArray(value.actionLinks)
      ? value.actionLinks
          .map((link) => normalizeActionLink(link))
          .filter((link): link is ActionLink => link !== null)
      : defaults.actionLinks,
    codeWindows: codeWindows.length > 0 ? codeWindows : defaults.codeWindows,
    activeCodeWindowId:
      asNonEmptyString(legacyPanel.activeCodeWindowId) ??
      asNonEmptyString(legacyPanel.activeLayoutId) ??
      defaults.activeCodeWindowId,
  });
};
