import type { NativeGesturePhase } from '../../../src/types/ipc/nativeCommandLeft';
export interface GestureLedger {
  arm(): number;
  disarm(): void;
  down(gesture: number): {
    status: 'accepted' | 'rejected' | 'overflow';
    epoch: number;
  };
  end(gesture: number): boolean;
  claim(gesture: number, expectedEpoch: number): NativeGesturePhase;
  isClaimCurrent(gesture: number, expectedEpoch: number): boolean;
  confirmStopped(gesture: number, expectedEpoch: number): boolean;
  retire(gesture: number, expectedEpoch: number): boolean;
  size(): number;
}
/** Window-scoped bounded gesture identities; issued events cannot be replayed. */
export const createGestureLedger = (limit: number): GestureLedger => {
  if (!Number.isSafeInteger(limit) || limit < 1)
    throw Error('INVALID_LEDGER_LIMIT');
  let epoch = 0;
  let accepting = false;
  let lastGesture = 0;
  const entries = new Map<
    number,
    { ended: boolean; claimed: boolean; stopped: boolean }
  >();
  return {
    arm(): number {
      epoch++;
      entries.clear();
      lastGesture = 0;
      accepting = true;
      return epoch;
    },
    disarm(): void {
      accepting = false;
      epoch++;
      entries.clear();
    },
    down(gesture: number): {
      status: 'accepted' | 'rejected' | 'overflow';
      epoch: number;
    } {
      if (
        !accepting ||
        !Number.isSafeInteger(gesture) ||
        gesture <= lastGesture ||
        entries.has(gesture)
      )
        return { status: 'rejected', epoch };
      if (entries.size >= limit) {
        accepting = false;
        entries.clear();
        epoch++;
        return { status: 'overflow', epoch };
      }
      lastGesture = gesture;
      entries.set(gesture, { ended: false, claimed: false, stopped: false });
      return { status: 'accepted', epoch };
    },
    end(gesture: number): boolean {
      const entry = accepting && entries.get(gesture);
      if (!entry || entry.ended) return false;
      entry.ended = true;
      return true;
    },
    claim(gesture: number, expectedEpoch: number): NativeGesturePhase {
      if (!accepting || expectedEpoch !== epoch) return 'invalid';
      const entry = entries.get(gesture);
      if (!entry || entry.claimed) return 'invalid';
      entry.claimed = true;
      return entry.ended ? 'ended' : 'active';
    },
    isClaimCurrent(gesture: number, expectedEpoch: number): boolean {
      const entry = entries.get(gesture);
      return Boolean(accepting && expectedEpoch === epoch && entry?.claimed && !entry.stopped);
    },
    confirmStopped(gesture: number, expectedEpoch: number): boolean {
      const entry = entries.get(gesture);
      if (
        !accepting ||
        expectedEpoch !== epoch ||
        !entry?.claimed ||
        !entry.ended
      )
        return false;
      entry.stopped = true;
      return true;
    },
    retire(gesture: number, expectedEpoch: number): boolean {
      const entry = entries.get(gesture);
      if (
        !accepting ||
        expectedEpoch !== epoch ||
        !entry?.ended ||
        (entry.claimed && !entry.stopped)
      )
        return false;
      entries.delete(gesture);
      return true;
    },
    size(): number {
      return entries.size;
    },
  };
};
