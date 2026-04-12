import type {
  AppSettings,
  CodeWindowLayout,
} from '../../../../../types/settings/coreTypes';
import { ActionList } from '../../../../../ActionList';
import { TEAM_PLACEHOLDERS } from '../../../../../utils/teamPlaceholder';

interface LabelGroup {
  groupName: string;
  options: string[];
}

export const buildSettingsWithCodeWindows = (
  settings: AppSettings,
  codeWindows: CodeWindowLayout[],
  activeCodeWindowId: string | null,
): AppSettings => {
  return {
    ...settings,
    codingPanel: {
      ...settings.codingPanel,
      defaultMode: settings.codingPanel?.defaultMode || 'code',
      toolbars: settings.codingPanel?.toolbars || [],
      codeWindows,
      activeCodeWindowId: activeCodeWindowId || undefined,
      actionLinks: settings.codingPanel?.actionLinks || [],
    },
  };
};

export const buildAvailableActions = (): string[] => {
  const baseActions = ActionList.map((action) => action.action);
  return baseActions.flatMap((action) => [
    `${TEAM_PLACEHOLDERS.TEAM1} ${action}`,
    `${TEAM_PLACEHOLDERS.TEAM2} ${action}`,
  ]);
};

export const buildAvailableLabelGroups = (): LabelGroup[] => {
  const groupMap = new Map<string, Set<string>>();

  ActionList.forEach((action) => {
    const groups = (
      action as { groups?: { groupName: string; options: string[] }[] }
    ).groups;
    if (Array.isArray(groups)) {
      groups.forEach((group) => {
        const existing = groupMap.get(group.groupName) || new Set<string>();
        group.options.forEach((option) => existing.add(option));
        groupMap.set(group.groupName, existing);
      });
    }

    if (action.results?.length > 0) {
      const existing = groupMap.get('Result') || new Set<string>();
      action.results.forEach((result) => existing.add(result));
      groupMap.set('Result', existing);
    }

    if (action.types?.length > 0) {
      const existing = groupMap.get('Type') || new Set<string>();
      action.types.forEach((type) => existing.add(type));
      groupMap.set('Type', existing);
    }
  });

  return Array.from(groupMap.entries()).map(([groupName, optionsSet]) => ({
    groupName,
    options: Array.from(optionsSet).sort((a, b) => a.localeCompare(b)),
  }));
};
