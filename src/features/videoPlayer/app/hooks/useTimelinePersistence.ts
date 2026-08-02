import { useEffect, useRef, useState } from 'react';
import type {
  TimelineData,
  TimelineRow,
} from '../../../../types/timeline/core';
import {
  readTimelineFile,
  writeTimelineFile,
} from '../gateways/timelineImportExportGateway';
import {
  parseTimelineDocument,
  serializeTimelineDocument,
} from '../utils/timelineDocument';

interface UseTimelinePersistenceResult {
  timeline: TimelineData[];
  setTimeline: React.Dispatch<React.SetStateAction<TimelineData[]>>;
  timelineRows: TimelineRow[];
  setTimelineRows: React.Dispatch<React.SetStateAction<TimelineRow[]>>;
  timelineFilePath: string;
  setTimelineFilePath: React.Dispatch<React.SetStateAction<string>>;
}

export const useTimelinePersistence = (): UseTimelinePersistenceResult => {
  const [timeline, setTimeline] = useState<TimelineData[]>([]);
  const [timelineRows, setTimelineRows] = useState<TimelineRow[]>([]);
  const [timelineFilePath, setTimelineFilePath] = useState('');
  const timelineLoadedRef = useRef(false);
  const timelinePersistedSnapshotRef = useRef('[]');
  const saveTimerRef = useRef<number | null>(null);

  useEffect(() => {
    timelineLoadedRef.current = false;
    timelinePersistedSnapshotRef.current = '[]';

    if (!timelineFilePath) {
      setTimeline([]);
      setTimelineRows([]);
      timelineLoadedRef.current = true;
      return;
    }

    let cancelled = false;
    const loadTimeline = async () => {
      try {
        const text = await readTimelineFile(timelineFilePath);
        if (!text) {
          throw new Error('Timeline file is empty or not accessible');
        }
        if (cancelled) return;
        const parsed = parseTimelineDocument(text);
        // 旧配列形式は読み込み時だけ移行し、ユーザーが編集するまでは書き換えない。
        timelinePersistedSnapshotRef.current = parsed.snapshot;
        timelineLoadedRef.current = true;
        setTimeline(parsed.timeline);
        setTimelineRows(parsed.rows);
      } catch (error) {
        if (cancelled) return;
        console.error('タイムラインの読み込みに失敗しました:', error);
        timelinePersistedSnapshotRef.current = '[]';
        timelineLoadedRef.current = true;
        setTimeline([]);
        setTimelineRows([]);
      }
    };

    void loadTimeline();

    return () => {
      cancelled = true;
    };
  }, [timelineFilePath]);

  useEffect(() => {
    if (!timelineFilePath || !timelineLoadedRef.current) {
      return;
    }

    const nextSnapshot = serializeTimelineDocument(timeline, timelineRows);
    if (nextSnapshot === timelinePersistedSnapshotRef.current) {
      return;
    }

    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = window.setTimeout(() => {
      writeTimelineFile(timelineFilePath, nextSnapshot)
        .then((saved) => {
          if (!saved) {
            throw new Error('Timeline write failed');
          }
          timelinePersistedSnapshotRef.current = nextSnapshot;
        })
        .catch((error: unknown) => {
          console.error('Failed to export timeline:', error);
        })
        .finally(() => {
          saveTimerRef.current = null;
        });
    }, 300);

    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [timeline, timelineFilePath, timelineRows]);

  return {
    timeline,
    setTimeline,
    timelineRows,
    setTimelineRows,
    timelineFilePath,
    setTimelineFilePath,
  };
};
