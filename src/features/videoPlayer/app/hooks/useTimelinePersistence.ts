import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  TimelineData,
  TimelineRow,
} from '../../../../types/timeline/core';
import {
  readTimelineFile,
  writeTimelineFile,
} from '../gateways/timelineImportExportGateway';
import { registerTimelineCloseHandler } from '../gateways/timelineCloseGateway';
import { isWithinPackageJsonSizeLimit } from '../../../../shared/packageJsonLimits';
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
  timelineEditable: boolean;
  loadRevision: number;
  canEditTimeline: () => boolean;
  timeline: TimelineData[];
  setTimeline: React.Dispatch<React.SetStateAction<TimelineData[]>>;
  timelineRows: TimelineRow[];
  setTimelineRows: React.Dispatch<React.SetStateAction<TimelineRow[]>>;
  timelineFilePath: string;
  setTimelineFilePath: React.Dispatch<React.SetStateAction<string>>;
}

interface TimelinePersistenceOptions {
  completeRows?: (
    timeline: TimelineData[],
    rows: TimelineRow[],
  ) => TimelineRow[];
}

export const useTimelinePersistence = ({
  completeRows,
}: TimelinePersistenceOptions = {}): UseTimelinePersistenceResult => {
  const [timeline, updateTimeline] = useState<TimelineData[]>([]);
  const [timelineRows, updateTimelineRows] = useState<TimelineRow[]>([]);
  // Capture edits synchronously, including a close request before React commits.
  const timelineRef = useRef<TimelineData[]>([]);
  const rowsRef = useRef<TimelineRow[]>([]);
  const closingRef = useRef(false);
  const completeRowsRef = useRef(completeRows);
  completeRowsRef.current = completeRows;
  const [timelineFilePath, updateTimelineFilePath] = useState('');
  const filePathRef = useRef('');
  const [timelineEditable, setTimelineEditable] = useState(false);
  const [loadRevision, setLoadRevision] = useState(0);
  const timelineLoadedRef = useRef(false);
  const timelinePersistedSnapshotRef = useRef('[]');
  const saveTimerRef = useRef<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [retrySaveKey, setRetrySaveKey] = useState(0);
  const writeQueueRef = useRef<Promise<void>>(Promise.resolve());
  const generationRef = useRef(0);
  const pendingWritesRef = useRef(0);
  const canEditTimeline = useCallback(
    () =>
      Boolean(filePathRef.current) &&
      timelineLoadedRef.current &&
      !closingRef.current,
    [],
  );
  const setTimelineFilePath: UseTimelinePersistenceResult['setTimelineFilePath'] =
    useCallback((value) => {
      if (closingRef.current) return;
      const next =
        typeof value === 'function' ? value(filePathRef.current) : value;
      if (next === filePathRef.current) return;
      filePathRef.current = next;
      timelineLoadedRef.current = false;
      setTimelineEditable(false);
      updateTimelineFilePath(next);
    }, []);
  const retryRead = useCallback(() => {
    if (closingRef.current) return;
    timelineLoadedRef.current = false;
    setTimelineEditable(false);
    setReloadKey((key) => key + 1);
  }, []);
  const retrySave = useCallback(() => setRetrySaveKey((key) => key + 1), []);

  const setTimeline: UseTimelinePersistenceResult['setTimeline'] = useCallback(
    (value) => {
      if (!timelineLoadedRef.current || closingRef.current) return;
      const next =
        typeof value === 'function' ? value(timelineRef.current) : value;
      timelineRef.current = next;
      updateTimeline(next);
    },
    [],
  );
  const setTimelineRows: UseTimelinePersistenceResult['setTimelineRows'] =
    useCallback((value) => {
      if (!timelineLoadedRef.current || closingRef.current) return;
      const next = typeof value === 'function' ? value(rowsRef.current) : value;
      rowsRef.current = next;
      updateTimelineRows(next);
    }, []);

  const clearSaveTimer = useCallback((): void => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
  }, []);

  const saveSnapshot = useCallback(
    (
      filePath: string,
      snapshot: string,
      generation: number,
    ): Promise<boolean> => {
      pendingWritesRef.current += 1;
      const completion = writeQueueRef.current.then(async () => {
        try {
          if (
            generation !== generationRef.current ||
            !timelineLoadedRef.current
          )
            return false;
          if (snapshot !== timelinePersistedSnapshotRef.current) {
            if (!(await writeTimelineFile(filePath, snapshot)))
              throw new Error('Timeline write failed');
            if (generation !== generationRef.current) return false;
            timelinePersistedSnapshotRef.current = snapshot;
          }
          setSaveError(null);
          return true;
        } catch (error: unknown) {
          console.error('Failed to export timeline:', error);
          if (generation === generationRef.current)
            setSaveError(
              !isWithinPackageJsonSizeLimit(snapshot)
                ? 'タイムラインの保存サイズが16 MiB（UTF-8）の上限を超えています。既存ファイルは変更せず、編集内容は画面に保持しています。必要な内容をエクスポートして保管し、変更を取り消すかメモ・場面の量を減らしてから保存を再試行してください。'
                : 'タイムラインの変更を保存できませんでした。変更は画面に残っています。保存先の接続・空き容量・アクセス権を確認し、保存を再試行してください。',
            );
          return false;
        } finally {
          pendingWritesRef.current -= 1;
        }
      });
      writeQueueRef.current = completion.then(() => undefined);
      return completion;
    },
    [],
  );

  const flushBeforeClose = useCallback(async (): Promise<boolean> => {
    closingRef.current = true;
    setTimelineEditable(false);
    clearSaveTimer();
    // A failed/unfinished initial read cannot have accepted edits. Never turn it
    // into an empty write; still wait for any previously submitted work.
    if (!filePathRef.current || !timelineLoadedRef.current) {
      await writeQueueRef.current;
      return true;
    }
    // Row derivation normally happens in the session's effect. Closing can
    // precede that commit, so complete its metadata before freezing the snapshot.
    const rows =
      completeRowsRef.current?.(timelineRef.current, rowsRef.current) ??
      rowsRef.current;
    rowsRef.current = rows;
    updateTimelineRows(rows);
    return saveSnapshot(
      filePathRef.current,
      serializeTimelineDocument(timelineRef.current, rows),
      generationRef.current,
    );
  }, [clearSaveTimer, saveSnapshot]);

  const resumeAfterCancelledClose = useCallback((): void => {
    closingRef.current = false;
    setTimelineEditable(
      Boolean(filePathRef.current) && timelineLoadedRef.current,
    );
  }, []);

  useEffect(
    () =>
      registerTimelineCloseHandler(flushBeforeClose, resumeAfterCancelledClose),
    [flushBeforeClose, resumeAfterCancelledClose],
  );

  useEffect(() => {
    timelineLoadedRef.current = false;
    generationRef.current += 1;
    setLoadRevision((revision) => revision + 1);
    setTimelineEditable(false);
    setLoadError(null);
    setSaveError(null);
    timelinePersistedSnapshotRef.current = '[]';

    if (!timelineFilePath) {
      timelineRef.current = [];
      rowsRef.current = [];
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
        setTimelineEditable(!closingRef.current);
        timelineRef.current = parsed.timeline;
        rowsRef.current = parsed.rows;
        updateTimeline(parsed.timeline);
        updateTimelineRows(parsed.rows);
      } catch (error) {
        if (cancelled) return;
        console.error('タイムラインの読み込みに失敗しました:', error);
        // A failed read is never a new empty document and must never enable autosave.
        timelineLoadedRef.current = false;
        timelineRef.current = [];
        rowsRef.current = [];
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
    if (!timelineFilePath || !timelineLoadedRef.current || closingRef.current) {
      return;
    }

    const nextSnapshot = serializeTimelineDocument(timeline, timelineRows);
    if (
      nextSnapshot === timelinePersistedSnapshotRef.current &&
      pendingWritesRef.current === 0
    ) {
      setSaveError(null);
      return;
    }

    clearSaveTimer();

    const generation = generationRef.current;
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      void saveSnapshot(timelineFilePath, nextSnapshot, generation);
    }, 300);

    return clearSaveTimer;
  }, [
    timeline,
    timelineFilePath,
    timelineRows,
    retrySaveKey,
    clearSaveTimer,
    saveSnapshot,
  ]);

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
    timelineEditable,
    loadRevision,
    canEditTimeline,
    timeline,
    setTimeline,
    timelineRows,
    setTimelineRows,
    timelineFilePath,
    setTimelineFilePath,
  };
};
