import type { ActionGroup } from '../../../types/settings/coreTypes';

export interface ActionLabelGroupSource {
  groups?: ActionGroup[];
  types?: readonly string[];
  results?: readonly string[];
}

export const resolveActionLabelGroups = (
  action: ActionLabelGroupSource | undefined,
): ActionGroup[] => {
  if (!action) {
    return [];
  }

  if (action.groups && action.groups.length > 0) {
    return action.groups.map((group) => ({
      groupName: group.groupName,
      options: [...group.options],
    }));
  }

  const legacyGroups: ActionGroup[] = [];
  if (action.types && action.types.length > 0) {
    legacyGroups.push({
      groupName: 'Type',
      options: [...action.types],
    });
  }
  if (action.results && action.results.length > 0) {
    legacyGroups.push({
      groupName: 'Result',
      options: [...action.results],
    });
  }
  return legacyGroups;
};
