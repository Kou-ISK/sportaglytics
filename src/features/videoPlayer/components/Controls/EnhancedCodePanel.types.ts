export interface EnhancedCodePanelProps {
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
  onApplyLabels?: (
    ids: string[],
    labels: { name: string; group: string }[],
  ) => void;
}

export interface EnhancedCodePanelHandle {
  triggerAction: (teamName: string, actionName: string) => void;
}
