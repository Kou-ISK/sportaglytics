import { useCallback, useEffect, useRef, useState } from 'react';
import type { TimelineWindowSyncPayload } from '../../../../types/ipc/timelineWindow';
import { createTimelineSyncAdmission } from '../../../../shared/timelineSyncAdmission';
import {
  sendTimelineWindowCommand,
  subscribeTimelineWindowClock,
  subscribeTimelineWindowSync,
} from '../gateways/timelineWindowGateway';

const CONFIRMATION_TIMEOUT_MS = 5000;
interface PendingSelection {
  documentId: string;
  requestId: string;
  ids: string[];
}
interface TimelineWindowSnapshot {
  snapshot: TimelineWindowSyncPayload | null;
  select: (ids: string[]) => void;
  previewTime: (time: number) => void;
}

/** Keep only selection optimistic; a matching committed receipt ends the intent. */
export const useTimelineWindowSnapshot = (): TimelineWindowSnapshot => {
  const [snapshot, setSnapshot] = useState<TimelineWindowSyncPayload | null>(
    null,
  );
  const canonical = useRef<TimelineWindowSyncPayload | null>(null);
  const pending = useRef<PendingSelection | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearPending = useCallback((): void => {
    pending.current = null;
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  }, []);
  useEffect(() => {
    const admission = createTimelineSyncAdmission();
    const unsubscribe = subscribeTimelineWindowSync((incoming) => {
      if (!admission.accept(incoming)) return;
      canonical.current = incoming;
      if (
        pending.current &&
        (pending.current.documentId !== incoming.documentId ||
          pending.current.requestId === incoming.selectionRequestId)
      )
        clearPending();
      setSnapshot(
        pending.current
          ? { ...incoming, selectedIds: pending.current.ids }
          : incoming,
      );
    });
    const unsubscribeClock = subscribeTimelineWindowClock((clock) => {
      if (canonical.current)
        canonical.current = { ...canonical.current, ...clock };
      setSnapshot((current) => (current ? { ...current, ...clock } : current));
    });
    sendTimelineWindowCommand({ type: 'request-sync' });
    return () => {
      clearPending();
      unsubscribeClock();
      unsubscribe();
      canonical.current = null;
    };
  }, [clearPending]);
  const documentId = snapshot?.documentId;
  const select = useCallback(
    (ids: string[]): void => {
      if (!documentId || canonical.current?.documentId !== documentId) return;
      clearPending();
      const intent = { documentId, requestId: crypto.randomUUID(), ids };
      pending.current = intent;
      setSnapshot((current) =>
        current?.documentId === documentId
          ? { ...current, selectedIds: ids }
          : current,
      );
      timer.current = setTimeout(() => {
        if (pending.current !== intent) return;
        clearPending();
        setSnapshot(canonical.current);
        // An uncertain selection is never replayed (nor is a delete operation).
        sendTimelineWindowCommand({ type: 'request-sync' });
      }, CONFIRMATION_TIMEOUT_MS);
      try {
        sendTimelineWindowCommand({ type: 'selection-change', ...intent });
      } catch (error) {
        clearPending();
        setSnapshot(canonical.current);
        throw error;
      }
    },
    [clearPending, documentId],
  );
  const previewTime = useCallback((time: number): void => {
    setSnapshot((current) =>
      current
        ? { ...current, currentTime: time, updatedAt: Date.now() }
        : current,
    );
  }, []);
  return { snapshot, select, previewTime };
};
