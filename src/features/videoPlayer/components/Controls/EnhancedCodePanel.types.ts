import type { SCLabel } from '../../../../types/timeline/sportscode';

export interface EnhancedCodePanelProps {
  /** Common package time, never a source file's currentTime; null when unavailable. */
  codingTime: number | null;
  addTimelineData: (
    actionName: string,
    startTime: number,
    endTime: number,
    memo: string,
    actionType?: string,
    actionResult?: string,
    labels?: Array<{ name: string; group: string }>,
    color?: string,
  ) => void;
  teamNames: string[];
  firstTeamName?: string;
  selectedIds?: string[];
  selectedTimelineLabels?: SCLabel[];
  onApplyLabels?: (
    ids: string[],
    labels: { name: string; group: string }[],
  ) => void;
  windowHotkeys?: Array<{ id: string; label: string; key: string }>;
  onHotkeyKeyDown?: (hotkeyId: string) => void;
  onHotkeyKeyUp?: (hotkeyId: string) => void;
  onActiveLayoutChange?: (
    layout:
      | import('../../../../types/settings/coreTypes').CodeWindowLayout
      | null,
  ) => void;
}

export interface EnhancedCodePanelHandle {
  triggerAction: (
    teamName: string,
    actionName: string,
    buttonId?: string,
  ) => void;
}
