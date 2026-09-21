import { visibleTimeMarkers } from '../domain/timelineZoom';
import { useCallback, useMemo } from 'react';
import type {
  TimelineData,
  TimelineRow,
} from '../../../../../../types/timeline/core';

interface UseTimelineDerivedDataParams {
  timeline: TimelineData[];
  rows: TimelineRow[];
  maxSec: number;
  zoomScale: number;
  containerWidth: number;
  scrollLeft: number;
}

export const useTimelineDerivedData = ({
  timeline,
  rows,
  maxSec,
  zoomScale,
  containerWidth,
  scrollLeft,
}: UseTimelineDerivedDataParams): {
  groupedByAction: Record<string, TimelineData[]>;
  rows: TimelineRow[];
  actionNames: string[];
  firstTeamName: string | undefined;
  formatTime: (seconds: number) => string;
  timeMarkers: number[];
} => {
  const groupedByAction = useMemo(() => {
    const groups: Record<string, TimelineData[]> = {};
    for (const item of timeline) {
      if (!groups[item.actionName]) {
        groups[item.actionName] = [];
      }
      groups[item.actionName].push(item);
    }
    return groups;
  }, [timeline]);

  const actionNames = useMemo(() => rows.map((row) => row.name), [rows]);

  const firstTeamName = useMemo(
    () => actionNames[0]?.split(' ')[0],
    [actionNames],
  );

  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const text = Number.isInteger(seconds)
      ? String(Math.floor(secs)).padStart(2, '0')
      : secs.toFixed(1).padStart(4, '0');
    return `${mins}:${text}`;
  }, []);

  const timeMarkers = useMemo(
    () => visibleTimeMarkers(maxSec, containerWidth, zoomScale, scrollLeft),
    [maxSec, containerWidth, zoomScale, scrollLeft],
  );

  return {
    groupedByAction,
    rows,
    actionNames,
    firstTeamName,
    formatTime,
    timeMarkers,
  };
};
