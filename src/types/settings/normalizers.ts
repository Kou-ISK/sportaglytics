import type {
  AppSettings,
  HotkeyConfig,
  ThemeMode,
} from './coreTypes';
import { DEFAULT_SETTINGS } from './defaults';
import { normalizeAnalysisDashboard } from './dashboardNormalizers';
import {
  normalizeCodingPanel,
  normalizeCodingPanelLayouts,
} from './codingPanelNormalizers';
import {
  asBoolean,
  asFiniteNumber,
  asNonEmptyString,
  cloneHotkey,
  isPlainObject,
} from './normalizerUtils';

const getDefaultAiAnalysis = (): NonNullable<AppSettings['aiAnalysis']> => ({
  provider: DEFAULT_SETTINGS.aiAnalysis?.provider ?? 'llama.cpp',
  baseUrl: DEFAULT_SETTINGS.aiAnalysis?.baseUrl ?? 'http://localhost:11434',
  model: DEFAULT_SETTINGS.aiAnalysis?.model ?? 'auto',
  temperature: DEFAULT_SETTINGS.aiAnalysis?.temperature ?? 0.2,
  topK: DEFAULT_SETTINGS.aiAnalysis?.topK ?? 40,
  embeddingEnabled: DEFAULT_SETTINGS.aiAnalysis?.embeddingEnabled ?? false,
  teamLabelGroup: DEFAULT_SETTINGS.aiAnalysis?.teamLabelGroup ?? '',
  retrieverPreset: DEFAULT_SETTINGS.aiAnalysis?.retrieverPreset ?? 'balanced',
});

const normalizeThemeMode = (value: unknown): ThemeMode => {
  return value === 'light' || value === 'dark' || value === 'system'
    ? value
    : DEFAULT_SETTINGS.themeMode;
};

const normalizeHotkeys = (value: unknown): HotkeyConfig[] => {
  const defaults = DEFAULT_SETTINGS.hotkeys.map(cloneHotkey);
  const defaultById = new Map(defaults.map((hotkey) => [hotkey.id, hotkey]));
  if (!Array.isArray(value)) {
    return defaults;
  }

  const normalized: HotkeyConfig[] = [];
  const seen = new Set<string>();
  value.forEach((entry) => {
    if (!isPlainObject(entry)) {
      return;
    }

    const id = asNonEmptyString(entry.id);
    if (!id || seen.has(id)) {
      return;
    }

    const fallback = defaultById.get(id);
    if (!fallback) {
      return;
    }

    const disabled = asBoolean(entry.disabled);
    normalized.push({
      id,
      label: asNonEmptyString(entry.label) ?? fallback.label,
      key: asNonEmptyString(entry.key) ?? fallback.key,
      ...(disabled != null
        ? { disabled }
        : fallback.disabled != null
          ? { disabled: fallback.disabled }
          : {}),
    });
    seen.add(id);
  });

  const missingDefaults = defaults.filter((hotkey) => !seen.has(hotkey.id));
  return normalized.length > 0 ? [...normalized, ...missingDefaults] : defaults;
};

const normalizeOverlayClip = (value: unknown): AppSettings['overlayClip'] => {
  const defaults = DEFAULT_SETTINGS.overlayClip;
  if (!isPlainObject(value)) {
    return { ...defaults };
  }

  return {
    enabled: asBoolean(value.enabled) ?? defaults.enabled,
    showActionName: asBoolean(value.showActionName) ?? defaults.showActionName,
    showActionIndex:
      asBoolean(value.showActionIndex) ?? defaults.showActionIndex,
    showLabels: asBoolean(value.showLabels) ?? defaults.showLabels,
    showMemo: asBoolean(value.showMemo) ?? defaults.showMemo,
  };
};

const normalizeAiAnalysis = (
  value: unknown,
): NonNullable<AppSettings['aiAnalysis']> => {
  const defaults = getDefaultAiAnalysis();
  if (!isPlainObject(value)) {
    return defaults;
  }

  const retrieverPreset =
    value.retrieverPreset === 'balanced' ||
    value.retrieverPreset === 'labels' ||
    value.retrieverPreset === 'memo' ||
    value.retrieverPreset === 'time'
      ? value.retrieverPreset
      : defaults.retrieverPreset;

  return {
    provider: 'llama.cpp',
    baseUrl: asNonEmptyString(value.baseUrl) ?? defaults.baseUrl,
    model: asNonEmptyString(value.model) ?? defaults.model,
    temperature: asFiniteNumber(value.temperature) ?? defaults.temperature,
    topK: asFiniteNumber(value.topK) ?? defaults.topK,
    embeddingEnabled:
      asBoolean(value.embeddingEnabled) ?? defaults.embeddingEnabled,
    teamLabelGroup:
      asNonEmptyString(value.teamLabelGroup) ?? defaults.teamLabelGroup,
    retrieverPreset,
  };
};

export const normalizeAppSettings = (value: unknown): AppSettings => {
  const settings = isPlainObject(value) ? value : {};

  return {
    themeMode: normalizeThemeMode(settings.themeMode),
    hotkeys: normalizeHotkeys(settings.hotkeys),
    language: asNonEmptyString(settings.language) ?? DEFAULT_SETTINGS.language,
    overlayClip: normalizeOverlayClip(settings.overlayClip),
    codingPanel: normalizeCodingPanel(settings.codingPanel),
    analysisDashboard: normalizeAnalysisDashboard(settings.analysisDashboard),
    aiAnalysis: normalizeAiAnalysis(settings.aiAnalysis),
  };
};

export { normalizeAnalysisDashboard, normalizeCodingPanelLayouts };
