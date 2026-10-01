import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

export interface TimelinePersistenceFeedback {
  kind: 'load-error' | 'save-error';
  message: string;
  onRetry: () => void;
}

interface UseTimelinePersistenceResult {
  persistenceFeedback: TimelinePersistenceFeedback | null;
  timeline: TimelineData[];
  setTimeline: React.Dispatch<React.SetStateAction<TimelineData[]>>;
  timelineRows: TimelineRow[];
  setTimelineRows: React.Dispatch<React.SetStateAction<TimelineRow[]>>;
  timelineFilePath: string;
  setTimelineFilePath: React.Dispatch<React.SetStateAction<string>>;
}

export const useTimelinePersistence = (): UseTimelinePersistenceResult => {
  const [timeline, updateTimeline] = useState<TimelineData[]>([]);
  const [timelineRows, updateTimelineRows] = useState<TimelineRow[]>([]);
  const [timelineFilePath, setTimelineFilePath] = useState('');
  const timelineLoadedRef = useRef(false);
  const timelinePersistedSnapshotRef = useRef('[]');
  const saveTimerRef = useRef<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [retrySaveKey, setRetrySaveKey] = useState(0);
  const writeQueueRef = useRef<Promise<void>>(Promise.resolve());
  const generationRef = useRef(0);
  const retryRead = useCallback(() => setReloadKey((key) => key + 1), []);
  const retrySave = useCallback(() => setRetrySaveKey((key) => key + 1), []);

  const setTimeline: UseTimelinePersistenceResult['setTimeline'] = useCallback(
    (value) => {
      if (timelineLoadedRef.current) updateTimeline(value);
    },
    [],
  );
  const setTimelineRows: UseTimelinePersistenceResult['setTimelineRows'] =
    useCallback((value) => {
      if (timelineLoadedRef.current) updateTimelineRows(value);
    }, []);

  useEffect(() => {
    timelineLoadedRef.current = false;
    generationRef.current += 1;
    setLoadError(null);
    setSaveError(null);
    timelinePersistedSnapshotRef.current = '[]';

    if (!timelineFilePath) {
      updateTimeline([]);
      updateTimelineRows([]);
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
        updateTimeline(parsed.timeline);
        updateTimelineRows(parsed.rows);
      } catch (error) {
        if (cancelled) return;
        console.error('タイムラインの読み込みに失敗しました:', error);
        // A failed read is never a new empty document and must never enable autosave.
        timelineLoadedRef.current = false;
        setLoadError(
          'タイムラインを読み込めませんでした。自動保存を停止し、原本を保持しています。接続・アクセス権・形式を確認して再読み込みしてください。',
        );
        updateTimeline([]);
        updateTimelineRows([]);
      }
    };

    void loadTimeline();

    return () => {
      cancelled = true;
    };
  }, [timelineFilePath, reloadKey]);

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

    const generation = generationRef.current;
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      // Serialize writes so an older edit cannot finish after a newer document.
      writeQueueRef.current = writeQueueRef.current.then(async () => {
        if (generation !== generationRef.current || !timelineLoadedRef.current)
          return;
        try {
          if (!(await writeTimelineFile(timelineFilePath, nextSnapshot)))
            throw new Error('Timeline write failed');
          if (generation === generationRef.current) {
            timelinePersistedSnapshotRef.current = nextSnapshot;
            setSaveError(null);
          }
        } catch (error: unknown) {
          console.error('Failed to export timeline:', error);
          if (generation === generationRef.current)
            setSaveError(
              'タイムラインの変更を保存できませんでした。変更は画面に残っています。保存先の接続・空き容量・アクセス権を確認し、保存を再試行してください。',
            );
        }
      });
    }, 300);

    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [timeline, timelineFilePath, timelineRows, retrySaveKey]);

  const persistenceFeedback = useMemo<TimelinePersistenceFeedback | null>(
    () =>
      loadError
        ? { kind: 'load-error', message: loadError, onRetry: retryRead }
        : saveError
          ? { kind: 'save-error', message: saveError, onRetry: retrySave }
          : null,
    [loadError, saveError, retryRead, retrySave],
  );
  return {
    persistenceFeedback,
    timeline,
    setTimeline,
    timelineRows,
    setTimelineRows,
    timelineFilePath,
    setTimelineFilePath,
  };
};
