import { useEffect, useRef, useState } from 'react';
import { TimelineData } from '../../types/TimelineData';
import { normalizeTimelineData } from '../../utils/scTimelineConverter';

interface UseTimelinePersistenceResult {
  timeline: TimelineData[];
  setTimeline: React.Dispatch<React.SetStateAction<TimelineData[]>>;
  timelineFilePath: string;
  setTimelineFilePath: React.Dispatch<React.SetStateAction<string>>;
}

export const useTimelinePersistence = (): UseTimelinePersistenceResult => {
  const [timeline, setTimeline] = useState<TimelineData[]>([]);
  const [timelineFilePath, setTimelineFilePath] = useState('');
  const timelineLoadedRef = useRef(false);
  const timelinePersistedSnapshotRef = useRef('[]');
  const saveTimerRef = useRef<number | null>(null);

  useEffect(() => {
    timelineLoadedRef.current = false;
    timelinePersistedSnapshotRef.current = '[]';

    if (!timelineFilePath) {
      setTimeline([]);
      timelineLoadedRef.current = true;
      return;
    }

    let cancelled = false;
    const loadTimeline = async () => {
      try {
        const response = await fetch(timelineFilePath);
        if (!response.ok) {
          throw new Error(
            `Failed to load timeline file: ${response.status} ${response.statusText}`,
          );
        }
        const raw = await response.json();
        if (cancelled) return;
        // 読み込んだデータを正規化してlabels配列を確実に持たせる
        const rawArray = Array.isArray(raw) ? raw : [];
        const normalized = rawArray.map((item) => normalizeTimelineData(item));
        // 読み込んだ元のデータ（正規化前）をスナップショットとして保存
        // これにより、正規化後のデータが変更として検知され、自動保存される
        timelinePersistedSnapshotRef.current = JSON.stringify(rawArray);
        timelineLoadedRef.current = true;
        setTimeline(normalized);
      } catch (error) {
        if (cancelled) return;
        console.error('タイムラインの読み込みに失敗しました:', error);
        timelinePersistedSnapshotRef.current = '[]';
        timelineLoadedRef.current = true;
        setTimeline([]);
      }
    };

    void loadTimeline();

    return () => {
      cancelled = true;
    };
  }, [timelineFilePath]);

  useEffect(() => {
    if (
      !timelineFilePath ||
      !window?.electronAPI?.exportTimeline ||
      typeof window.electronAPI.exportTimeline !== 'function' ||
      !timelineLoadedRef.current
    ) {
      return;
    }

    const nextSnapshot = JSON.stringify(timeline);
    if (nextSnapshot === timelinePersistedSnapshotRef.current) {
      return;
    }

    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
    }

    const payload = timeline.map((item) => ({ ...item }));

    saveTimerRef.current = window.setTimeout(() => {
      console.debug('[useTimelinePersistence] Saving timeline:', payload);
      window.electronAPI
        ?.exportTimeline(timelineFilePath, payload)
        .then(() => {
          timelinePersistedSnapshotRef.current = nextSnapshot;
          console.debug('[useTimelinePersistence] Timeline saved successfully');
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
  }, [timeline, timelineFilePath]);

  return {
    timeline,
    setTimeline,
    timelineFilePath,
    setTimelineFilePath,
  };
};
