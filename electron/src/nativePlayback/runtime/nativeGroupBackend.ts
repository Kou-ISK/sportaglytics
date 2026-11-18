import type { BrowserWindow } from 'electron';
import { powerSaveBlocker } from 'electron';
import { createHash } from 'node:crypto';
import path from 'node:path';
import type { NativePlaybackBackend } from '../nativePlaybackSession';
import type { NativePackageSourcePlan } from '../nativePackageSourcePlan';
import type { NativePlaybackClosed, NativePlaybackOwner } from '../../../../src/types/ipc/nativePlayback';
import type { NativeRuntimePaths } from './nativeRuntime';
import type { NativeGroupCapability } from './groupCapability';
import { parseNativeGroupCapability } from './groupCapability';
import { nativeGroupHostConfiguration } from '../nativeHostConfiguration';
import { nativeGroupHostIntent } from '../nativeGroupControl';
import { createGroupSurfaceTransport } from './groupSurfaceTransport';
import { createOwnedBackend } from './support/embedded-diagnostic/owned-backend.cjs';
import type { OwnedProcessTermination } from './support/embedded-diagnostic/owned-backend.cjs';
import { createPlaybackActivity } from './playbackActivity';
import { createSessionDirectory, readNativeReceipt, removeOwnedSession } from './sessionStorage';

export interface NativeGroupBackend extends NativePlaybackBackend {
  /** Physical child/pipe closure only, including an abnormal exit. This does
   * not authorize HTML recovery, delete retained sessions or prove GPU drain. */
  termination(): Promise<OwnedProcessTermination>;
}

/** Main composition only: paths/capability must come from
 * resolveSignedNativeGroupResources, and plan from the authenticated package.
 * Nothing here grants a Renderer executable, path, handle or source clock. */
export const createNativeGroupBackend = (
  paths: NativeRuntimePaths,
  capability: NativeGroupCapability,
  window: BrowserWindow,
  plan: NativePackageSourcePlan,
  audioAngleId: string,
  owner: NativePlaybackOwner,
  observe: (value: unknown) => void,
  height: 720 | 1080 = 1080,
): NativeGroupBackend => {
  const negotiated = parseNativeGroupCapability(capability);
  if (height !== 1080 && (height !== 720 || !negotiated.additionalLayout)) throw Error('NATIVE_GROUP_LAYOUT');
  const configuration = nativeGroupHostConfiguration(plan, audioAngleId);
  let session: string | null = null;
  let surface: ReturnType<typeof createGroupSurfaceTransport> | null = null;
  let backend: ReturnType<typeof createOwnedBackend> | null = null;
  let owned: NativePlaybackBackend | null = null;
  let activity: ReturnType<typeof createPlaybackActivity> | null = null;
  let closeWork: Promise<NativePlaybackClosed> | null = null;
  let initialError: unknown, receipt: Record<string, unknown> | null = null;
  let closeRequested = false, factoryAttempted = false;
  const note = (kind: string, value: Record<string, unknown> = {}): void => {
    if (kind === 'native-drained') receipt = value;
    if (kind === 'host-spawn' && typeof value.pid === 'number') surface?.setPeer(value.pid);
  };
  const closeSurface = async (processExited: boolean): Promise<void> => {
    if (!surface) return;
    await surface.drain(processExited);
    surface.close();
  };
  const stopActivity = (): void => {
    const lease = activity;
    activity = null;
    lease?.stop();
  };
  // Return the owner before filesystem/addon/process initialization. Explicit
  // close may supersede it even while source revalidation is pending.
  const initialization = Promise.resolve().then(async () => {
    if (closeRequested) return;
    await plan.assertCurrent();
    if (closeRequested) return;
    session = createSessionDirectory(path.join(paths.state, 'sessions'));
    surface = createGroupSurfaceTransport(paths.receiver, () => window, plan,
      owner, note, () => observe(null), undefined, height);
    surface.start();
    backend = createOwnedBackend({ host: paths.host, run: session,
      manifest: { ...configuration, surfaceService: surface.service, surfaceOwnerPID: process.pid },
      note, surfaceReady: (id) => {
        if (!surface) throw Error('NATIVE_GROUP_SURFACE_MISSING');
        surface.ready(id);
      } });
    factoryAttempted = true;
    owned = backend.factory(owner, observe);
    activity = createPlaybackActivity(powerSaveBlocker);
    if (!activity.start().registered) throw Error('NATIVE_ACTIVITY_REGISTRATION');
  }).catch((error: unknown) => { initialError = error; });
  return {
    termination: async () => {
      await initialization;
      if (factoryAttempted && !owned) throw Error('NATIVE_INITIALIZATION_UNKNOWN');
      if (!factoryAttempted) return { generation: owner.generation,
        processStarted: false, processExited: true, pipesClosed: true };
      const value = await backend?.termination();
      if (!value || value.generation !== owner.generation ||
          typeof value.processStarted !== 'boolean' ||
          value.processExited !== true || value.pipesClosed !== true)
        throw Error('NATIVE_TERMINATION_UNCONFIRMED');
      return Object.freeze({ generation: value.generation,
        processStarted: value.processStarted, processExited: true, pipesClosed: true });
    },
    confirmsPresentation: (value) => surface?.confirmsPresentation(value) === true,
    confirmsPresentedStop: (proof) => surface?.confirmsPresentedStop(proof) === true,
    write: async (intent) => {
      await initialization;
      if (initialError) throw initialError;
      if (closeRequested || !owned || !surface) throw Error('NATIVE_STARTUP_CANCELLED');
      await plan.assertCurrent();
      if (closeRequested) throw Error('NATIVE_STARTUP_CANCELLED');
      const wire = nativeGroupHostIntent(intent, (proof, value) => {
        if (!surface) throw Error('NATIVE_GROUP_SURFACE_MISSING');
        return surface.validateStop(proof, value);
      });
      surface.intent(intent);
      await owned.write(wire);
    },
    close: (): Promise<NativePlaybackClosed> => {
      if (closeWork) return closeWork;
      closeRequested = true;
      closeWork = (async (): Promise<NativePlaybackClosed> => {
        await initialization;
        surface?.stopRequests();
        if (factoryAttempted && !owned) throw Error('NATIVE_INITIALIZATION_UNKNOWN');
        let closed: NativePlaybackClosed;
        try {
          closed = owned ? await owned.close() : { generation: owner.generation,
            processStarted: false, processExited: true, nativeDrained: true,
            pipesClosed: true, stopped: null };
          if (backend) await backend.done();
          if (closed.generation !== owner.generation || !closed.processExited ||
              !closed.pipesClosed || !closed.nativeDrained || closed.stopped)
            throw Error('NATIVE_GROUP_DRAIN_UNCONFIRMED');
        } catch (error) {
          // Physical process closure can release texture loans, but cannot
          // manufacture a successful native drain or a stopped source clock.
          try {
            const termination = await backend?.termination();
            if (termination?.generation === owner.generation &&
                termination.processExited && termination.pipesClosed)
              await closeSurface(true);
          } catch { /* Keep the original failure and owned session. */ }
          throw error;
        }
        const presentedStop = surface?.presented() ?? null;
        await closeSurface(true);
        if (closed.processStarted) {
          if (!session) throw Error('NATIVE_SESSION_MISSING');
          const bytes = await readNativeReceipt(session);
          if (!receipt?.resultPersisted || receipt.resultSHA256 !==
              createHash('sha256').update(bytes).digest('hex'))
            throw Error('NATIVE_RECEIPT_MISMATCH');
          const value: unknown = JSON.parse(bytes.toString('utf8'));
          if (!value || typeof value !== 'object' || !('engine' in value) ||
              value.engine !== 'AVPlayerGroup' || !('success' in value) || value.success !== true ||
              !('stoppedClock' in value) || value.stoppedClock !== null ||
              !('heldBytes' in value) || value.heldBytes !== 0 ||
              !('quarantinedBytes' in value) || value.quarantinedBytes !== 0 ||
              !('peakChargedImageBytes' in value) ||
              typeof value.peakChargedImageBytes !== 'number' ||
              !Number.isSafeInteger(value.peakChargedImageBytes) ||
              value.peakChargedImageBytes < 0 ||
              value.peakChargedImageBytes > negotiated.imageBudgetBytes)
            throw Error('NATIVE_GROUP_RECEIPT_UNCONFIRMED');
        }
        stopActivity();
        if (session) {
          try { await removeOwnedSession(session); }
          catch { /* Keep only our unremoved session; no user/source cleanup. */ }
        }
        return { ...closed, ...(presentedStop ? { presentedStop } : {}) };
      })().catch((error: unknown) => {
        try { stopActivity(); } catch { /* Preserve the original drain failure. */ }
        throw error;
      });
      return closeWork;
    },
  };
};
