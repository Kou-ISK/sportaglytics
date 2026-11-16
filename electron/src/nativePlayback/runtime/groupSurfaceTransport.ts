import { ipcMain, sharedTexture } from 'electron';
import type { BrowserWindow, IpcMainEvent } from 'electron';
import { randomUUID } from 'node:crypto';
import {
  objectValue,
  exactKeys,
  integerValue,
  booleanValue,
} from '../../../../src/shared/validation/jsonValues';
import { nativeGroupSurfaceChannels as channels } from '../../../../src/types/ipc/nativeGroupSurface';
import type {
  NativeGroupSurfaceMetadata,
  NativeGroupPresentation,
} from '../../../../src/types/ipc/nativeGroupSurface';
import type {
  NativePlaybackIntent,
  NativePlaybackOwner,
} from '../../../../src/types/ipc/nativePlayback';
import type { NativePackageSourcePlan } from '../nativePackageSourcePlan';
import { createLifetime } from './support/embedded-diagnostic/surface-lifetime.cjs';
import { GroupFrameAdmission } from './groupFrameAdmission';
import { GroupPresentationLedger } from './groupPresentationLedger';
import { loadNativeGroupReceiver } from './groupSurfaceReceiver';
import type {
  NativeGroupReceiver,
  NativeGroupSurfacePacket,
} from './groupSurfaceReceiver';

interface Flight {
  packet: NativeGroupSurfacePacket;
  meta: NativeGroupSurfaceMetadata;
  texture: Electron.SharedTextureImported | null;
  lifetime: ReturnType<typeof createLifetime>;
  acknowledged: boolean;
}
export interface GroupSurfaceTransport {
  readonly service: string;
  start(): void;
  setPeer(pid: number): void;
  intent(value: NativePlaybackIntent): void;
  ready(id: number): void;
  /** Last complete acknowledged pair, distinct from requested/player clocks. */
  presented(): NativeGroupPresentation | null;
  validateStop(
    proof: unknown,
    intent: NativePlaybackIntent,
  ): NativeGroupPresentation;
  stopRequests(): void;
  /** Called only after the owned producer has exited and its pipes closed. */
  drain(producerExited: boolean): Promise<void>;
  close(): void;
}

/** Main adapter only. Caller supplies a verified addon, authenticated package
 * plan and captured window. Renderer receives metadata/textures, never handles. */
export const createGroupSurfaceTransport = (
  verifiedReceiverPath: string,
  getWindow: () => BrowserWindow | null,
  plan: NativePackageSourcePlan,
  owner: NativePlaybackOwner,
  note: (kind: string, value: Record<string, unknown>) => void,
  cancel: (reason: string, cause?: unknown) => void,
  receiverFactory: (
    path: string,
  ) => NativeGroupReceiver = loadNativeGroupReceiver,
): GroupSurfaceTransport => {
  const native = receiverFactory(verifiedReceiverPath),
    admission = new GroupFrameAdmission(plan, owner);
  const service = 'local.sportaglytics.surface.group-' + randomUUID(),
    document = randomUUID();
  const flights = new Map<number, Flight>(),
    recovered = new Set<number>(),
    rawUnknown = new Set<number>();
  const presentation = new GroupPresentationLedger();
  let drained = false;
  let started = false,
    opened = false,
    stopped = false,
    closeAttempted = false,
    closeError: unknown;
  let failed = false,
    originalError: unknown,
    demandPending = false,
    lastNotice = 0;
  let cleanup: ReturnType<typeof setInterval> | undefined;
  const fail = (reason: string, cause: unknown = new Error(reason)): void => {
    if (failed) return;
    failed = true;
    stopped = true;
    originalError = cause;
    try {
      note('surface-failure', { reason });
    } catch {
      /* Preserve first failure. */
    }
    try {
      cancel(reason, cause);
    } catch {
      /* Cancellation may already have executed. */
    }
  };
  const report = (kind: string, value: Record<string, unknown>): void => {
    try {
      note(kind, value);
    } catch (error) {
      fail('group surface trace failure', error);
    }
  };
  const authorized = (event: IpcMainEvent): boolean => {
    const window = getWindow();
    return (
      !!window &&
      !window.isDestroyed() &&
      event.sender === window.webContents &&
      event.senderFrame === window.webContents.mainFrame
    );
  };
  const rawRelease = (packet: NativeGroupSurfacePacket): void => {
    if (rawUnknown.has(packet.id)) return;
    try {
      native.release(packet.id);
    } catch (error) {
      rawUnknown.add(packet.id);
      fail('group pre-transfer release uncertain', error);
    }
  };
  const onDraw = (event: IpcMainEvent, raw: unknown): void => {
    if (!authorized(event)) return;
    let id: number, drawn: boolean;
    try {
      const value = objectValue(raw);
      exactKeys(value, ['document', 'id', 'drawn']);
      if (value.document !== document) return;
      id = integerValue(value.id, 1);
      drawn = booleanValue(value.drawn);
    } catch {
      return;
    }
    const flight = flights.get(id);
    if (!flight || flight.acknowledged) return;
    try {
      if (drawn) {
        const pair = presentation.drawn(flight.meta);
        if (pair)
          report('surface-pair-drawn', {
            pair: pair.pair,
            globalTicks: pair.globalTicks,
          });
      }
      if (drawn && !stopped && admission.isCurrent(flight.packet))
        native.drawn(id);
      flight.acknowledged = true;
      flight.lifetime.acknowledge();
      report('surface-draw-ack', {
        id,
        drawn,
        angle: flight.packet.angle,
        pair: flight.packet.pair,
      });
    } catch (error) {
      fail('group surface acknowledgement failed', error);
    }
  };
  const onRequest = (event: IpcMainEvent, value: unknown): void => {
    if (stopped || demandPending || value !== document || !authorized(event))
      return;
    try {
      native.request();
      demandPending = true;
    } catch (error) {
      fail('group surface demand failed', error);
    }
  };
  const onError = (event: IpcMainEvent): void => {
    if (authorized(event)) fail('group surface presentation failed');
  };
  const receive = (notice: number | null): boolean => {
    let packet: NativeGroupSurfacePacket | null = null;
    let imported = false;
    try {
      packet = native.poll();
      if (!packet) {
        if (notice !== null) fail('group notice without packet');
        return false;
      }
      demandPending = false;
      if (notice === null) {
        if (recovered.size >= 2400) throw Error('NATIVE_GROUP_NOTICE_BOUND');
        recovered.add(packet.id);
      } else if (notice !== packet.id)
        throw Error('NATIVE_GROUP_NOTICE_MISMATCH');
      if (stopped) {
        rawRelease(packet);
        return true;
      }
      const { handle, surfaceID: _surfaceID, ...identity } = packet;
      const frame = admission.accept(identity);
      const window = getWindow();
      if (!frame || !window || window.isDestroyed()) {
        rawRelease(packet);
        return true;
      }
      const meta: NativeGroupSurfaceMetadata = {
        ...frame,
        version: 2,
        generation: owner.generation,
        document,
      };
      presentation.publish(meta);
      const id = packet.id;
      const lifetime = createLifetime(() => {
        native.release(id);
        flights.delete(id);
        report('surface-released', { id });
      });
      const flight: Flight = {
        packet,
        meta,
        texture: null,
        lifetime,
        acknowledged: false,
      };
      flights.set(id, flight);
      imported = true;
      if (frame.content === 'blank') {
        // No imported texture refers to the blank placeholder. Clearing a media
        // canvas is acknowledged separately; old image flights keep their fences.
        lifetime.gpuRelease();
        window.webContents.send(channels.blank, meta);
        lifetime.transfer();
        return true;
      }
      flight.texture = sharedTexture.importSharedTexture({
        textureInfo: {
          handle: { ioSurface: handle },
          pixelFormat: 'nv12',
          codedSize: { width: 1920, height: 1080 },
          visibleRect: { x: 0, y: 0, width: 1920, height: 1080 },
          timestamp: Math.round((frame.sourcePTS * 1e6) / 120000),
          colorSpace: {
            primaries: 'bt709',
            transfer: 'bt709',
            matrix: 'bt709',
            range: 'limited',
          },
        },
        allReferencesReleased: () => {
          try {
            lifetime.gpuRelease();
          } catch (error) {
            fail('group GPU release uncertain', error);
          }
        },
      });
      void sharedTexture
        .sendSharedTexture(
          {
            frame: window.webContents.mainFrame,
            importedSharedTexture: flight.texture,
          },
          meta,
        )
        .then(
          () => {
            try {
              // Relinquish Main's import before the last lifetime milestone can
              // return the producer's original pixel to its pool.
              flight.texture?.release();
              flight.texture = null;
              lifetime.transfer();
            } catch (error) {
              lifetime.quarantine();
              fail('group transfer release uncertain', error);
            }
          },
          (error: unknown) => {
            lifetime.quarantine();
            fail('group texture transfer uncertain', error);
          },
        );
      return true;
    } catch (error) {
      if (packet && !imported) rawRelease(packet);
      else if (packet) flights.get(packet.id)?.lifetime.quarantine();
      fail('group surface receive failed', error);
      return false;
    }
  };
  const clearCleanup = (): void => {
    if (cleanup !== undefined) clearInterval(cleanup);
    cleanup = undefined;
  };
  const stopRequests = (): void => {
    stopped = true;
    if (!opened || cleanup !== undefined) return;
    const end = performance.now() + 15000;
    cleanup = setInterval(() => {
      if (performance.now() >= end) {
        clearCleanup();
        fail('group cleanup deadline');
        return;
      }
      for (let i = 0; i < 6; ++i) if (!receive(null)) break;
    }, 10);
  };
  return {
    service,
    presented: () => presentation.presented(),
    validateStop: (proof, intent) => {
      if (stopped || failed || closeAttempted)
        throw Error('NATIVE_GROUP_SURFACE_CLOSING');
      return presentation.stop(proof, intent, owner);
    },
    start: (): void => {
      if (started || closeAttempted)
        throw Error('NATIVE_GROUP_SURFACE_START_ATTEMPTED');
      started = true;
      native.open(service);
      opened = true;
      ipcMain.on(channels.drawn, onDraw);
      ipcMain.on(channels.request, onRequest);
      ipcMain.on(channels.error, onError);
    },
    setPeer: (pid) => native.setPeer(pid),
    intent: (value) => {
      if (closeAttempted || stopped)
        throw Error('NATIVE_GROUP_SURFACE_CLOSING');
      admission.expect(value);
    },
    ready: (id): void => {
      if (closeAttempted) return;
      if (!Number.isSafeInteger(id) || id !== lastNotice + 1) {
        fail('group notice sequence invalid');
        return;
      }
      lastNotice = id;
      if (recovered.delete(id)) return;
      receive(id);
    },
    stopRequests,
    drain: async (producerExited): Promise<void> => {
      if (!producerExited)
        throw Error('NATIVE_GROUP_PRODUCER_EXIT_UNCONFIRMED');
      if (!opened) return;
      stopRequests();
      const end = performance.now() + 3000;
      try {
        while (true) {
          for (let i = 0; i < 6; ++i) if (!receive(null)) break;
          if (
            rawUnknown.size ||
            [...flights.values()].some((f) => f.lifetime.uncertain())
          )
            throw Object.assign(
              Error('NATIVE_GROUP_SURFACE_RELEASE_UNCONFIRMED'),
              { cause: originalError },
            );
          if (!flights.size && native.count() === 0) {
            drained = true;
            return;
          }
          if (performance.now() >= end)
            throw Object.assign(Error('NATIVE_GROUP_SURFACE_DRAIN_TIMEOUT'), {
              cause: originalError,
            });
          await new Promise((done) => setTimeout(done, 10));
        }
      } catch (error) {
        clearCleanup();
        throw error;
      }
    },
    close: (): void => {
      if (closeAttempted) {
        if (closeError) throw closeError;
        return;
      }
      closeAttempted = true;
      try {
        if (opened && !drained) throw Error('NATIVE_GROUP_DRAIN_UNCONFIRMED');
        if (flights.size || rawUnknown.size)
          throw Object.assign(
            Error('NATIVE_GROUP_SURFACE_OWNERSHIP_UNRESOLVED'),
            { cause: originalError },
          );
        if (started) native.close();
        opened = false;
        clearCleanup();
        ipcMain.removeListener(channels.drawn, onDraw);
        ipcMain.removeListener(channels.request, onRequest);
        ipcMain.removeListener(channels.error, onError);
      } catch (error) {
        closeError = error;
        clearCleanup();
        throw error;
      }
    },
  };
};
