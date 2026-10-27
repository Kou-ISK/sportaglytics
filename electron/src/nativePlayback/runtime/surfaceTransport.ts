import { createLifetime } from './support/embedded-diagnostic/surface-lifetime.cjs';
import { ipcMain, sharedTexture } from 'electron';
import type { BrowserWindow } from 'electron';
import { randomUUID } from 'node:crypto';
interface Frame {
  id: number;
  generation: number;
  seekId: number;
  pts: number;
  surfaceID: number;
  handle: Buffer;
}
interface NativeReceiver {
  open: (name: string) => void;
  setPeer: (pid: number) => void;
  poll: () => Frame | null;
  request: () => void;
  drawn: (id: number) => void;
  release: (id: number) => void;
  count: () => number;
  close: () => void;
}
interface Flight {
  packet: Frame;
  owner: string;
  released: boolean;
  transferred: boolean;
  acknowledged: boolean;
  quarantined: boolean;
  texture: Electron.SharedTextureImported | null;
  lifetime: ReturnType<typeof createLifetime> | null;
}
export function createSurfaceTransport(
  receiverPath: string,
  getWindow: () => BrowserWindow | null,
  note: (kind: string, value: Record<string, unknown>) => void,
  cancel: (reason: string) => void,
  deferStart = false,
  diagnosticStage?: (event: number, id: number) => void,
): {
  service: string;
  start: () => void;
  setPeer: (pid: number) => void;
  ready: (id: number) => void;
  intent: (value: Record<string, unknown>) => void;
  stopRequests: () => void;
  drain: () => Promise<void>;
  close: () => void;
} {
  // Main-only local addon. No native pointer or Mach port is exposed through IPC.
  const native: NativeReceiver = require(receiverPath);
  const service = 'local.sportaglytics.surface.' + randomUUID();
  const document = randomUUID();
  let startAttempted = false,
    opened = false,
    closeAttempted = false,
    closeFailure: unknown;
  let expected: { generation: string; seekId: number } | null = null,
    stopped = false,
    demandPending = false,
    failureReported = false,
    lastNotice = 0;
  let cleanupTimer: ReturnType<typeof setInterval> | undefined;
  const flights = new Map<number, Flight>(),
    recoveredBeforeNotice = new Set<number>(),
    rawReleaseUnknown = new Set<number>();
  const fail = (reason: string): void => {
    if (failureReported) return;
    failureReported = true;
    stopped = true;
    try {
      note('surface-failure', { reason });
    } catch {
      /* Logging failure must not prevent cancellation. */
    } finally {
      cancel(reason);
    }
  };
  const report = (kind: string, value: Record<string, unknown>): boolean => {
    try {
      note(kind, value);
      return true;
    } catch (error) {
      fail('surface trace failure: ' + String(error));
      return false;
    }
  };
  const release = (f: Flight): void => {
    try {
      if (f.quarantined) f.lifetime?.quarantine();
      if (f.released) f.lifetime?.gpuRelease();
      if (f.transferred) f.lifetime?.transfer();
      if (f.acknowledged) f.lifetime?.acknowledge();
    } catch (e) {
      fail(String(e));
    }
  };
  const releaseUnimported = (packet: Frame): void => {
    if (rawReleaseUnknown.has(packet.id)) return;
    try {
      native.release(packet.id);
    } catch (error) {
      rawReleaseUnknown.add(packet.id);
      fail('pre-transfer release uncertain: ' + String(error));
    }
  };
  const onDraw = (event: Electron.IpcMainEvent, value: unknown): void => {
    const window = getWindow();
    if (
      !window ||
      event.sender !== window.webContents ||
      event.senderFrame !== window.webContents.mainFrame
    )
      return;
    if (
      !value ||
      typeof value !== 'object' ||
      !('id' in value) ||
      !('document' in value) ||
      value.document !== document ||
      typeof value.id !== 'number'
    )
      return;
    const f = flights.get(value.id);
    if (!f || f.acknowledged) return;
    const drawn = 'drawn' in value && value.drawn === true;
    if (drawn) {
      if (
        expected?.generation !== f.owner ||
        expected.seekId !== f.packet.seekId
      ) {
        report('stale-draw-rejected', { id: f.packet.id });
      } else {
        try {
          native.drawn(f.packet.id);
        } catch (e) {
          fail(String(e));
          return;
        }
      }
    }
    f.acknowledged = true;
    report('surface-draw-ack', {
      id: f.packet.id,
      drawn,
      seekId: f.packet.seekId,
      pts: f.packet.pts,
    });
    release(f);
  };
  const onRequest = (event: Electron.IpcMainEvent, value: unknown): void => {
    const w = getWindow();
    if (
      stopped ||
      demandPending ||
      !w ||
      event.sender !== w.webContents ||
      event.senderFrame !== w.webContents.mainFrame ||
      value !== document
    )
      return;
    try {
      const began = performance.now();
      native.request();
      demandPending = true;
      report('surface-demand', {
        seekId: expected?.seekId,
        callMs: performance.now() - began,
      });
    } catch (e) {
      fail(String(e));
    }
  };
  const receive = (noticeID: number | null): boolean => {
    try {
      const began = performance.now(),
        packet = native.poll(),
        pollMs = performance.now() - began;
      if (!packet) {
        if (noticeID !== null) fail('surface notice without packet');
        return false;
      }
      demandPending = false;
      if (noticeID === null) {
        if (recoveredBeforeNotice.size >= 2400) {
          releaseUnimported(packet);
          fail('cleanup notice ledger bound');
          return false;
        }
        recoveredBeforeNotice.add(packet.id);
      } else if (packet.id !== noticeID) {
        releaseUnimported(packet);
        fail('surface notice/packet mismatch');
        return false;
      }
      if (
        !report('surface-notice', {
          id: packet.id,
          pollMs,
          cleanup: noticeID === null,
        })
      ) {
        releaseUnimported(packet);
        return true;
      }
      const window = getWindow();
      if (
        stopped ||
        !window ||
        !expected ||
        packet.seekId !== expected.seekId
      ) {
        releaseUnimported(packet);
        report('surface-stale-before-transfer', { id: packet.id });
        return true;
      }
      const f: Flight = {
        packet,
        owner: expected.generation,
        released: false,
        transferred: false,
        acknowledged: false,
        quarantined: false,
        texture: null,
        lifetime: null,
      };
      flights.set(packet.id, f);
      f.lifetime = createLifetime(() => {
        native.release(packet.id);
        flights.delete(packet.id);
        report('surface-released', { id: packet.id });
      });
      const importBegan = performance.now();
      f.texture = sharedTexture.importSharedTexture({
        textureInfo: {
          handle: { ioSurface: packet.handle },
          pixelFormat: 'nv12',
          codedSize: { width: 1920, height: 1080 },
          visibleRect: { x: 0, y: 0, width: 1920, height: 1080 },
          timestamp: Math.round((packet.pts * 1e6) / 120000),
          colorSpace: {
            primaries: 'bt709',
            transfer: 'bt709',
            matrix: 'bt709',
            range: 'limited',
          },
        },
        allReferencesReleased: () => {
          try {
            diagnosticStage?.(108, packet.id);
          } catch {}
          f.released = true;
          release(f);
        },
      });
      const importMs = performance.now() - importBegan;
      const metadata = {
        document,
        id: packet.id,
        generation: f.owner,
        nativeGeneration: packet.generation,
        seekId: packet.seekId,
        pts: packet.pts,
      };
      report('surface-transfer', {
        ...metadata,
        surfaceID: packet.surfaceID,
        pollMs,
        importMs,
        trigger: 'owned-host-notice',
      });
      void sharedTexture
        .sendSharedTexture(
          {
            frame: window.webContents.mainFrame,
            importedSharedTexture: f.texture,
          },
          metadata,
        )
        .then(() => {
          try {
            diagnosticStage?.(109, packet.id);
          } catch {}
          f.transferred = true;
          f.texture?.release();
          f.texture = null;
          release(f);
        })
        .catch((error) => {
          // A late receiver can exist after send timeout. Do not reuse the sample.
          f.quarantined = true;
          f.lifetime?.quarantine();
          fail('uncertain texture transfer: ' + String(error));
        });
      return true;
    } catch (e) {
      fail(String(e));
      return false;
    }
  };
  const ready = (id: number): void => {
    if (!Number.isSafeInteger(id) || id !== lastNotice + 1) {
      fail('invalid/duplicate surface notice sequence');
      return;
    }
    lastNotice = id;
    if (recoveredBeforeNotice.delete(id)) return;
    receive(id);
  };
  const stopRequests = (): void => {
    stopped = true;
    if (!opened) return;
    if (cleanupTimer !== undefined) return;
    // Start BEFORE awaiting producer close: its pending Mach packets need release
    // even when the corresponding stdout notification was lost or is delayed.
    cleanupTimer = setInterval(() => {
      for (let i = 0; i < 3; i++) if (!receive(null)) break;
    }, 10);
  };
  const result = {
    service,
    start: (): void => {
      if (startAttempted || closeAttempted)
        throw Error('surface start already attempted');
      startAttempted = true;
      native.open(service);
      opened = true;
      ipcMain.on('diagnostic-surface-request', onRequest);
      ipcMain.on('diagnostic-surface-drawn', onDraw);
    },
    setPeer: (pid: number) => native.setPeer(pid),
    ready,
    intent: (value: Record<string, unknown>) => {
      if (
        typeof value.generation !== 'string' ||
        !Number.isSafeInteger(value.seekId)
      )
        throw Error('invalid intent surface gate');
      expected = { generation: value.generation, seekId: Number(value.seekId) };
    },
    stopRequests,
    drain: async () => {
      if (!opened) return;
      // Caller has confirmed producer exit; native.count alone cannot prove the
      // unread Mach queue empty while the producer is still alive.
      stopRequests();
      const end = performance.now() + 3000;
      while (flights.size || native.count()) {
        if (rawReleaseUnknown.size || performance.now() > end)
          throw Error('surface drain uncertain');
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    },
    close: () => {
      if (closeAttempted) {
        if (closeFailure) throw closeFailure;
        return;
      }
      closeAttempted = true;
      try {
        if (flights.size || rawReleaseUnknown.size)
          throw Error('surface ownership unresolved');
        if (opened) {
          native.close();
          opened = false;
        }
        if (cleanupTimer !== undefined) clearInterval(cleanupTimer);
        cleanupTimer = undefined;
        ipcMain.removeListener('diagnostic-surface-drawn', onDraw);
        ipcMain.removeListener('diagnostic-surface-request', onRequest);
      } catch (error) {
        closeFailure = error;
        throw error;
      }
    },
  };
  if (!deferStart) result.start();
  return result;
}
