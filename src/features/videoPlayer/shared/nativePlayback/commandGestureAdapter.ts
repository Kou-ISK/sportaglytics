import type { IElectronAPI } from '../../../../renderer';
import type { NativeCommandLeftEvent } from '../../../../types/ipc/nativeCommandLeft';
import { createNativeGestureQueue } from '../../../../hooks/nativeGestureQueue';
import type { NativePlaybackController } from './nativePlaybackController';
import { completeCommandGesture } from './completeCommandGesture';

type CommandApi = NonNullable<IElectronAPI['nativeCommandLeft']>;
type Lease = { controller: NativePlaybackController; id: number };
interface Options {
  api: CommandApi;
  epoch: number;
  current: () => NativePlaybackController | null;
  onControls: (playing: boolean, rate: number) => void;
  onFailure: (error: unknown) => void;
}
/** A per-epoch queue; Main's verified revoke is the admission boundary. */
export const createCommandGestureAdapter = (options: Options) => {
  const leases = new Map<string, Lease>();
  const reservations = new Map<string, Lease>();
  const finishes = new Set<AbortController>();
  let revocation: Promise<void> | null = null;
  let cancelled = false;
  const requestBefore = async (deadline: number): Promise<Awaited<ReturnType<CommandApi['revoke']>>> => {
    const remaining = deadline - performance.now();
    if (remaining <= 0) throw Error('NATIVE_GESTURE_REVOKE_TIMEOUT');
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        options.api.revoke(options.epoch),
        new Promise<never>((_, reject) => { timer = setTimeout(() => reject(Error('NATIVE_GESTURE_REVOKE_TIMEOUT')), remaining); }),
      ]);
    } finally { if (timer !== undefined) clearTimeout(timer); }
  };
  const revoke = (): Promise<void> => {
    if (revocation) return revocation;
    revocation = (async () => {
      const deadline = performance.now() + 5000;
      do {
        const result = await requestBefore(deadline);
        if (result === 'revoked' || result === 'already-revoked') return;
        if (result !== 'pending') throw Error('NATIVE_GESTURE_REVOKE_REJECTED');
        await new Promise<void>((resolve) => setTimeout(resolve, 20));
      } while (performance.now() < deadline);
      throw Error('NATIVE_GESTURE_REVOKE_TIMEOUT');
    })();
    return revocation;
  };
  const queue = createNativeGestureQueue({
    initialEpoch: options.epoch, limit: 24,
    claimStart: async (event) => {
      const controller = options.current();
      if (!controller || cancelled || !await controller.prepareCommandGesture(6) ||
          cancelled || options.current() !== controller) return 'invalid';
      const id = controller.reserveCommandGesture(6, revoke);
      if (id === null) return 'invalid';
      const key = `${event.epoch}:${event.gesture}`;
      reservations.set(key, { controller, id });
      try {
        const result = await options.api.claim(event.gesture, event.epoch);
        if (result !== 'invalid') return result;
        controller.interruptCommandGesture();
        await revoke(); reservations.delete(key);
        return result;
      } catch (error) {
        controller.interruptCommandGesture();
        await revoke(); reservations.delete(key);
        throw error;
      }
    },
    abandonClaim: async (event) => {
      const key = `${event.epoch}:${event.gesture}`;
      reservations.get(key)?.controller.interruptCommandGesture();
      await revoke(); reservations.delete(key);
    },
    start: async (event) => {
      const key = `${event.epoch}:${event.gesture}`;
      const reservation = reservations.get(key);
      const controller = options.current();
      if (!controller || cancelled || reservation?.controller !== controller) return null;
      const id = await controller.startCommandGesture(reservation.id,
        (intent) => options.api.apply(event.gesture, event.epoch, intent));
      if (id === null) return null;
      reservations.delete(key);
      leases.set(key, { controller, id });
      return key;
    },
    onStarted: (_event, key) => {
      const lease = leases.get(key);
      if (!cancelled && lease && options.current() === lease.controller && lease.controller.hasCommandGesture(lease.id))
        options.onControls(true, -6);
    },
    finish: async (event, key) => {
      const lease = leases.get(key);
      if (!lease) throw Error('NATIVE_GESTURE_UNKNOWN');
      if (cancelled || options.current() !== lease.controller || !lease.controller.hasCommandGesture(lease.id)) {
        await revoke(); leases.delete(key); return;
      }
      const revision = lease.controller.commandRevision;
      const abort = new AbortController();
      finishes.add(abort);
      const timer = setTimeout(() => abort.abort(), 5000);
      try {
        await completeCommandGesture(lease.controller, 6, lease.id, revision, options.current,
          () => options.api.retire(event.gesture, event.epoch), abort.signal,
          () => options.onControls(false, 1));
        leases.delete(key);
      } finally { finishes.delete(abort); clearTimeout(timer); }
    },
    onOverflow: () => { void revoke().catch((error) => { try { options.onFailure(error); } catch { /* already revoked or held */ } }); },
    onFailure: (error) => { void revoke().catch(() => {}); if (!cancelled) options.onFailure(error); },
  });
  return {
    receive(event: NativeCommandLeftEvent): boolean { return !cancelled && queue.receive(event); },
    /** Do not wait for a potentially lost claim reply after Main confirms revoke. */
    async cancel(): Promise<void> { cancelled = true; for (const finish of finishes) finish.abort();
      for (const reservation of reservations.values()) reservation.controller.interruptCommandGesture();
      queue.cancel(); await revoke(); },
  };
};
