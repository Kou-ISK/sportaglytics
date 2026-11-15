import { parseTimelineDocumentId } from '../types/ipc/timelineWindow';
import type { TimelineWindowSyncPayload } from '../types/ipc/timelineWindow';

interface TimelineSyncAdmission {
  accept: (payload: TimelineWindowSyncPayload) => boolean;
  owns: (documentId: string) => boolean;
}
/** Used only after current-main-frame and package-session sender admission. */
export const createTimelineSyncAdmission = (): TimelineSyncAdmission => {
  let latest: Pick<
    TimelineWindowSyncPayload,
    'documentId' | 'syncVersion'
  > | null = null;
  const retiredOwners = new Set<string>();
  return {
    accept: (payload): boolean => {
      const owner = parseTimelineDocumentId(payload.documentId);
      const previous = latest && parseTimelineDocumentId(latest.documentId);
      if (
        !owner ||
        retiredOwners.has(owner.instanceId) ||
        (previous &&
          owner.instanceId === previous.instanceId &&
          (owner.generation < previous.generation ||
            payload.syncVersion <= (latest?.syncVersion ?? 0)))
      )
        return false;
      if (previous && owner.instanceId !== previous.instanceId) {
        // Bounded fail-closed history: never allow an A -> B -> delayed A rollback.
        // A new package session gets a new gate; no old edit is retried on exhaustion.
        if (retiredOwners.size >= 1024) return false;
        retiredOwners.add(previous.instanceId);
      }
      latest = {
        documentId: payload.documentId,
        syncVersion: payload.syncVersion,
      };
      return true;
    },
    owns: (documentId): boolean => latest?.documentId === documentId,
  };
};
