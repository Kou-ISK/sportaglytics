import type { CodeWindowLayout } from '../../../types/settings/coreTypes';
import type { TimelineRow } from '../../../types/timeline/core';
import { getDefaultTimelineRowColor } from './timelineRows';

export interface ActionPresentation {
  actionName: string;
  color: string;
  source: 'code-window' | 'timeline-row' | 'default';
}

const normalizeActionName = (value: string): string => value.trim();

export const resolveActionPresentation = (
  actionName: string,
  activeCodeWindow: CodeWindowLayout | undefined,
  existingRow: TimelineRow | undefined,
): ActionPresentation => {
  const normalizedActionName = normalizeActionName(actionName);
  const actionButton = activeCodeWindow?.buttons.find(
    (button) =>
      button.type === 'action' &&
      normalizeActionName(button.name) === normalizedActionName &&
      typeof button.color === 'string' &&
      button.color.trim().length > 0,
  );

  if (actionButton?.color) {
    return {
      actionName: normalizedActionName,
      color: actionButton.color,
      source: 'code-window',
    };
  }

  if (existingRow?.color) {
    return {
      actionName: normalizedActionName,
      color: existingRow.color,
      source: 'timeline-row',
    };
  }

  return {
    actionName: normalizedActionName,
    color: getDefaultTimelineRowColor(normalizedActionName),
    source: 'default',
  };
};

export const buildActionPresentationMap = (
  actionNames: string[],
  activeCodeWindow: CodeWindowLayout | undefined,
  rows: TimelineRow[],
): Map<string, ActionPresentation> => {
  const rowsByName = new Map(rows.map((row) => [row.name, row]));
  return new Map(
    actionNames.map((actionName) => {
      const presentation = resolveActionPresentation(
        actionName,
        activeCodeWindow,
        rowsByName.get(actionName),
      );
      return [actionName, presentation];
    }),
  );
};
