import type {
  ActionDefinition,
  CodeWindowLayout,
  HotkeyConfig,
} from '../settings/coreTypes';
import type { SCLabel } from '../timeline/sportscode';

export const CODING_PANEL_WINDOW_CHANNELS = {
  openWindow: 'coding-panel:open-window',
  closeWindow: 'coding-panel:close-window',
  isWindowOpen: 'coding-panel:is-window-open',
  syncToWindow: 'coding-panel:sync-to-window',
  sync: 'coding-panel:sync',
  command: 'coding-panel:command',
} as const;

export interface CodingPanelWindowSyncPayload {
  activeMode: 'code' | 'label';
  customLayout: CodeWindowLayout | null;
  teamNames: string[];
  firstTeamName?: string;
  activeActions: ActionDefinition[];
  activeRecordings: Record<string, { startTime: number }>;
  primaryAction: string | null;
  activeLabelButtons: Record<string, boolean>;
  isRecording: boolean;
  labelSelections: Record<string, Record<string, string>>;
  selectedTimelineLabels: SCLabel[];
  statusMessage: string | null;
  hotkeys: HotkeyConfig[];
  codeWindowFilePath?: string;
}

export type CodingPanelWindowCommand =
  | { type: 'request-sync' }
  | { type: 'layout-updated'; layout: CodeWindowLayout }
  | {
      type: 'save-layout';
      layout: CodeWindowLayout;
      saveAs: boolean;
      filePath?: string;
    }
  | { type: 'hotkey-key-down'; hotkeyId: string }
  | { type: 'hotkey-key-up'; hotkeyId: string }
  | { type: 'custom-button-click'; buttonId: string }
  | { type: 'action-click'; teamName: string; actionName: string }
  | {
      type: 'label-select';
      actionName: string;
      groupName: string;
      option: string;
    };

export interface ICodingPanelWindowAPI {
  openWindow: () => Promise<void>;
  closeWindow: () => Promise<void>;
  isWindowOpen: () => Promise<boolean>;
  syncToWindow: (payload: CodingPanelWindowSyncPayload) => void;
  sendCommand: (command: CodingPanelWindowCommand) => void;
  onSync: (callback: (payload: CodingPanelWindowSyncPayload) => void) => void;
  offSync: (callback: (payload: CodingPanelWindowSyncPayload) => void) => void;
  onCommand: (callback: (command: CodingPanelWindowCommand) => void) => void;
  offCommand: (callback: (command: CodingPanelWindowCommand) => void) => void;
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isString = (value: unknown): value is string => typeof value === 'string';

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(isString);

const isActionDefinition = (value: unknown): value is ActionDefinition => {
  if (!isPlainObject(value)) return false;
  return (
    isString(value.action) &&
    isStringArray(value.results) &&
    isStringArray(value.types) &&
    (value.groups === undefined ||
      (Array.isArray(value.groups) &&
        value.groups.every(
          (group) =>
            isPlainObject(group) &&
            isString(group.groupName) &&
            isStringArray(group.options),
        )))
  );
};

const isHotkeyConfig = (value: unknown): value is HotkeyConfig => {
  if (!isPlainObject(value)) return false;
  return (
    isString(value.id) &&
    isString(value.label) &&
    isString(value.key) &&
    (value.disabled === undefined || typeof value.disabled === 'boolean')
  );
};

const isButtonLink = (value: unknown): boolean => {
  if (!isPlainObject(value)) return false;
  return (
    isString(value.id) &&
    isString(value.fromButtonId) &&
    isString(value.toButtonId) &&
    (value.type === 'exclusive' ||
      value.type === 'deactivate' ||
      value.type === 'activate' ||
      value.type === 'sequence')
  );
};

const isCodeWindowButton = (value: unknown): boolean => {
  if (!isPlainObject(value)) return false;
  return (
    isString(value.id) &&
    (value.type === 'action' || value.type === 'label') &&
    isString(value.name) &&
    isFiniteNumber(value.x) &&
    isFiniteNumber(value.y) &&
    isFiniteNumber(value.width) &&
    isFiniteNumber(value.height)
  );
};

const isCodeWindowLayout = (value: unknown): value is CodeWindowLayout => {
  if (!isPlainObject(value)) return false;
  return (
    isString(value.id) &&
    isString(value.name) &&
    isFiniteNumber(value.canvasWidth) &&
    isFiniteNumber(value.canvasHeight) &&
    Array.isArray(value.buttons) &&
    value.buttons.every(isCodeWindowButton) &&
    (value.buttonLinks === undefined ||
      (Array.isArray(value.buttonLinks) &&
        value.buttonLinks.every(isButtonLink)))
  );
};

const isRecordingMap = (
  value: unknown,
): value is Record<string, { startTime: number }> => {
  if (!isPlainObject(value)) return false;
  return Object.values(value).every(
    (entry) => isPlainObject(entry) && isFiniteNumber(entry.startTime),
  );
};

const isBooleanMap = (value: unknown): value is Record<string, boolean> => {
  if (!isPlainObject(value)) return false;
  return Object.values(value).every((entry) => typeof entry === 'boolean');
};

const isLabelSelections = (
  value: unknown,
): value is Record<string, Record<string, string>> => {
  if (!isPlainObject(value)) return false;
  return Object.values(value).every((entry) => {
    if (!isPlainObject(entry)) return false;
    return Object.values(entry).every(isString);
  });
};

const isTimelineLabel = (value: unknown): value is SCLabel => {
  if (!isPlainObject(value)) return false;
  return (
    isString(value.name) &&
    (value.group === undefined || isString(value.group))
  );
};

export const isCodingPanelWindowSyncPayload = (
  value: unknown,
): value is CodingPanelWindowSyncPayload => {
  if (!isPlainObject(value)) return false;
  return (
    (value.activeMode === 'code' || value.activeMode === 'label') &&
    (value.customLayout === null || isCodeWindowLayout(value.customLayout)) &&
    isStringArray(value.teamNames) &&
    (value.firstTeamName === undefined || isString(value.firstTeamName)) &&
    Array.isArray(value.activeActions) &&
    value.activeActions.every(isActionDefinition) &&
    isRecordingMap(value.activeRecordings) &&
    (value.primaryAction === null || isString(value.primaryAction)) &&
    isBooleanMap(value.activeLabelButtons) &&
    typeof value.isRecording === 'boolean' &&
    isLabelSelections(value.labelSelections) &&
    Array.isArray(value.selectedTimelineLabels) &&
    value.selectedTimelineLabels.every(isTimelineLabel) &&
    (value.statusMessage === null || isString(value.statusMessage)) &&
    Array.isArray(value.hotkeys) &&
    value.hotkeys.every(isHotkeyConfig) &&
    (value.codeWindowFilePath === undefined ||
      isString(value.codeWindowFilePath))
  );
};

export const isCodingPanelWindowCommand = (
  value: unknown,
): value is CodingPanelWindowCommand => {
  if (!isPlainObject(value) || !isString(value.type)) return false;

  if (value.type === 'request-sync') {
    return true;
  }

  if (value.type === 'layout-updated') {
    return isCodeWindowLayout(value.layout);
  }

  if (value.type === 'save-layout') {
    return (
      isCodeWindowLayout(value.layout) &&
      typeof value.saveAs === 'boolean' &&
      (value.filePath === undefined || isString(value.filePath))
    );
  }

  if (value.type === 'hotkey-key-down' || value.type === 'hotkey-key-up') {
    return isString(value.hotkeyId);
  }

  if (value.type === 'custom-button-click') {
    return isString(value.buttonId);
  }

  if (value.type === 'action-click') {
    return isString(value.teamName) && isString(value.actionName);
  }

  if (value.type === 'label-select') {
    return (
      isString(value.actionName) &&
      isString(value.groupName) &&
      isString(value.option)
    );
  }

  return false;
};
