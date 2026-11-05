import type {
  NativeCommandLeftEvent,
  NativeGesturePhase,
} from '../types/ipc/nativeCommandLeft';

type Entry = {
  event: NativeCommandLeftEvent;
  ended: boolean;
  generation: number;
};
type QueueOptions = {
  claimStart: (event: NativeCommandLeftEvent) => Promise<NativeGesturePhase>;
  /** A successful late claim must be revoked and its captured owner drained. */
  abandonClaim: (event: NativeCommandLeftEvent) => Promise<void>;
  start: (event: NativeCommandLeftEvent) => Promise<string | null>;
  finish: (event: NativeCommandLeftEvent, token: string) => Promise<void>;
  onStarted?: (event: NativeCommandLeftEvent, token: string) => void;
  onOverflow: () => void;
  onFailure?: (error: unknown) => void;
  limit: number;
  initialEpoch: number;
};

/** Controller-owned tokens ensure that an old release cannot stop a new operation. */
export interface NativeGestureQueue {
  receive(event: NativeCommandLeftEvent): boolean;
  invalidatePending(): void;
  cancel(): void;
  suspendAndWait(): Promise<void>;
  resume(newEpoch: number): boolean;
  cancelAndWait(): Promise<void>;
  dispose(): void;
}
export const createNativeGestureQueue = (
  options: QueueOptions,
): NativeGestureQueue => {
  let generation = 0;
  let epoch = options.initialEpoch;
  let serial = 0;
  let running = false;
  let active: { entry: Entry; token: string } | null = null;
  let starting: Entry | null = null;
  let pending: Entry[] = [];
  // Main can report an already-ended claim before its release notification
  // reaches Renderer. Accept that one late release without restarting it.
  const awaitingRelease = new Set<number>();
  let disposed = false;
  let suspended = false;
  let resumeReady = false;
  let failed = false;
  let failure: unknown = null;
  let runningDone: Promise<void> | null = null;
  let settling: Promise<void> = Promise.resolve();
  const fail = (error: unknown): void => {
    if (failed) return;
    failed = true;
    failure = error;
    generation++;
    pending = [];
    try { options.onFailure?.(error); } catch { /* cleanup must still run */ }
  };
  const finishActive = (): void => {
    const held = active;
    active = null;
    if (held)
      settling = settling
        .then(() => options.finish(held.entry.event, held.token))
        .catch(fail);
  };
  const drain = async (): Promise<void> => {
    if (running || active || disposed || failed) return;
    running = true;
    try {
      while (!active && pending.length && !disposed && !failed) {
        await settling;
        if (disposed || failed) break;
        const entry = pending[0];
        if (!entry) break;
        let validity: NativeGesturePhase = 'invalid';
        try {
          validity = await options.claimStart(entry.event);
        } catch {
          /* input fails closed */
        }
        if (pending[0] !== entry) {
          if (validity !== 'invalid') {
            try { await options.abandonClaim(entry.event); } catch (error) { fail(error); }
          }
          continue;
        }
        pending.shift();
        if (
          validity === 'invalid' ||
          entry.generation !== generation ||
          entry.event.epoch !== epoch ||
          disposed
        ) {
          if (validity !== 'invalid') {
            try { await options.abandonClaim(entry.event); } catch (error) { fail(error); }
          }
          continue;
        }
        if (validity === 'ended' && !entry.ended) {
          if (awaitingRelease.size >= options.limit) {
            fail(Error('NATIVE_GESTURE_RELEASE_BOUND'));
            try { await options.abandonClaim(entry.event); } catch { /* failure already retained */ }
            break;
          }
          awaitingRelease.add(entry.event.gesture);
          entry.ended = true;
        }
        starting = entry;
        let token: string | null = null;
        try {
          token = await options.start(entry.event);
        } catch (error) {
          fail(error);
        }
        starting = null;
        if (token === null) {
          try { await options.abandonClaim(entry.event); } catch (error) { fail(error); }
          continue;
        }
        active = { entry, token };
        if (
          !entry.ended &&
          entry.generation === generation &&
          entry.event.epoch === epoch &&
          !disposed
        ) {
          try {
            options.onStarted?.(entry.event, token);
          } catch (error) {
            fail(error);
            finishActive();
            await settling;
            break;
          }
        }
        if (
          entry.ended ||
          entry.generation !== generation ||
          entry.event.epoch !== epoch ||
          disposed
        ) {
          finishActive();
          await settling;
        }
      }
    } finally {
      running = false;
    }
  };
  const schedule = (): void => {
    if (runningDone || disposed || failed) return;
    runningDone = drain().finally(() => {
      runningDone = null;
      if (pending.length && !active && !disposed && !failed) schedule();
    });
  };
  const cancel = (): void => {
    generation++;
    pending = [];
    finishActive();
  };
  return {
    receive(event: NativeCommandLeftEvent): boolean {
      if (
        disposed ||
        suspended ||
        failed ||
        event.epoch !== epoch ||
        !Number.isSafeInteger(event.serial) ||
        event.serial <= serial ||
        !Number.isSafeInteger(event.gesture) ||
        event.gesture <= 0
      )
        return false;
      serial = event.serial;
      if (event.phase === 'down') {
        if (pending.length >= options.limit) {
          cancel();
          options.onOverflow();
          return false;
        }
        pending.push({ event, ended: false, generation });
        schedule();
      } else if (active?.entry.event.gesture === event.gesture) {
        finishActive();
        void settling.then(schedule);
      } else if (starting?.event.gesture === event.gesture) {
        if (starting.ended && !awaitingRelease.delete(event.gesture)) return false;
        awaitingRelease.delete(event.gesture);
        starting.ended = true;
      } else {
        const entry = pending.find(
          (item) => item.event.gesture === event.gesture,
        );
        if (!entry) return awaitingRelease.delete(event.gesture);
        if (entry.ended) return false;
        entry.ended = true;
      }
      return true;
    },
    invalidatePending(): void {
      generation++;
      pending = [];
    },
    cancel,
    async suspendAndWait(): Promise<void> {
      suspended = true;
      resumeReady = false;
      cancel();
      await runningDone;
      await settling;
      if (failed) throw failure;
      if (!disposed) resumeReady = true;
    },
    resume(newEpoch: number): boolean {
      if (
        disposed ||
        failed ||
        !suspended ||
        !resumeReady ||
        !Number.isSafeInteger(newEpoch) ||
        newEpoch <= epoch
      )
        return false;
      epoch = newEpoch;
      serial = 0;
      suspended = false;
      resumeReady = false;
      return true;
    },
    async cancelAndWait(): Promise<void> {
      cancel();
      await runningDone;
      await settling;
      if (failed) throw failure;
    },
    dispose(): void {
      disposed = true;
      generation++;
      pending = [];
      finishActive();
    },
  };
};
