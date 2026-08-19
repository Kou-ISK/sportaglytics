import { useEffect, useMemo } from 'react';
import type { CodeWindowLayout } from '../../../../types/settings/coreTypes';
import type { TimelineData, TimelineRow } from '../../../../types/timeline/core';
import { buildActionPresentationMap } from '../../shared/actionPresentation';

interface UseTimelineActionPresentationSyncParams {
  activeCodeWindow: CodeWindowLayout | undefined;
  timeline: TimelineData[];
  rows: TimelineRow[];
  onSynchronize: (colors: ReadonlyMap<string, string>) => void;
}

export const useTimelineActionPresentationSync = ({
  activeCodeWindow,
  timeline,
  rows,
  onSynchronize,
}: UseTimelineActionPresentationSyncParams): void => {
  const codeWindowColors = useMemo(() => {
    const actionNames = Array.from(
      new Set([...rows.map((row) => row.name), ...timeline.map((item) => item.actionName)]),
    );
    const presentations = buildActionPresentationMap(
      actionNames,
      activeCodeWindow,
      rows,
    );
    return new Map(
      Array.from(presentations.entries())
        .filter(([, presentation]) => presentation.source === 'code-window')
        .map(([actionName, presentation]) => [actionName, presentation.color]),
    );
  }, [activeCodeWindow, rows, timeline]);

  useEffect(() => {
    onSynchronize(codeWindowColors);
  }, [codeWindowColors, onSynchronize]);
};
