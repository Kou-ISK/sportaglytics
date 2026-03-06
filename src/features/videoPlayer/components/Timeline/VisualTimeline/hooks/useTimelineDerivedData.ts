import { useCallback, useMemo } from 'react';
import type { TimelineData } from '../../../../../../types/TimelineData';

interface UseTimelineDerivedDataParams {
  timeline: TimelineData[];
  maxSec: number;
  zoomScale: number;
}

export const useTimelineDerivedData = ({
  timeline,
  maxSec,
  zoomScale,
}: UseTimelineDerivedDataParams) => {
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

  const actionNames = useMemo(
    () => Object.keys(groupedByAction).sort((a, b) => a.localeCompare(b)),
    [groupedByAction],
  );

  const firstTeamName = useMemo(
    () => actionNames[0]?.split(' ')[0],
    [actionNames],
  );

  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const timeMarkers = useMemo(() => {
    const markers: number[] = [];
    if (maxSec <= 0) return markers;

    const getBaseInterval = (duration: number): number => {
      if (duration <= 60) return 10;
      if (duration <= 300) return 30;
      if (duration <= 600) return 60;
      if (duration <= 1800) return 300;
      return 600;
    };

    const ALLOWED_INTERVALS = [5, 10, 30, 60, 300, 600];
    const baseInterval = getBaseInterval(maxSec);
    const targetInterval = baseInterval / zoomScale;
    const interval = ALLOWED_INTERVALS.reduce((prev, curr) =>
      Math.abs(curr - targetInterval) < Math.abs(prev - targetInterval)
        ? curr
        : prev,
    );

    for (let i = 0; i <= maxSec; i += interval) {
      markers.push(i);
    }
    return markers;
  }, [maxSec, zoomScale]);

  return {
    groupedByAction,
    actionNames,
    firstTeamName,
    formatTime,
    timeMarkers,
  };
};
