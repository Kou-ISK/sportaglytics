import { BrowserWindow } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import {
  objectValue,
  booleanValue,
} from '../../../src/shared/validation/jsonValues';
import type { CacheValidation } from './cachePolicy';
import { CacheHardwareEvidence } from './cacheHardwareEvidence';
import {
  planCacheCompatibility,
  readCacheHardwareCoverage,
} from './cacheHardwareCoverage';
import type { CacheHardwareMode } from './cacheHardwareCoverage';
import { runCacheHardwareProbe } from './cacheHardwareProbePage';

export type CacheHardwareProbeResult = CacheValidation['hardware'] & {
  probe: {
    ended: boolean;
    frames: number;
    maximumTime: number;
    elapsedMs: number;
    properties: { playerId: string; name: string; value: string }[];
  };
};
/** Probe the exact candidate in a fresh player in the same Electron runtime.
 * Creation requires full playback; reuse requires bounded compatibility ranges.
 * Isolated, muted, local-only, no preload, no IPC, no network or external port.
 * This proves the bounded probe, not long-video playback or physical scrub. */
export const probeCacheHardware = async (
  candidate: string,
  privateDirectory: string,
  runtime: string,
  signal: AbortSignal,
  stopWaiting: (unconfirmed: boolean) => void,
  retainCleanup: (cleanup: () => Promise<void>) => void,
  mode: CacheHardwareMode = 'full',
  presentationEnd?: number,
): Promise<CacheHardwareProbeResult> => {
  const started = performance.now();
  const deadline = started + (mode === 'full' ? 150000 : 30000);
  signal.throwIfAborted();
  const directory = await fs.mkdtemp(
    path.join(privateDirectory, 'cache-probe-'),
  );
  const htmlPath = path.join(directory, 'probe.html');
  let stamp: { dev: bigint; ino: bigint } | undefined;
  let cleaned = false;
  const cleanup = async (): Promise<void> => {
    if (cleaned) return;
    if (!stamp) {
      // No content is written before initialization. Remove only an empty
      // directory; never traverse or unlink an unverified replacement.
      await fs.rmdir(directory);
      cleaned = true;
      return;
    }
    const current = await fs.lstat(directory, { bigint: true });
    if (
      !current.isDirectory() ||
      current.isSymbolicLink() ||
      current.dev !== stamp.dev ||
      current.ino !== stamp.ino
    )
      throw Error('CACHE_PROBE_DIRECTORY_CHANGED');
    await fs.unlink(htmlPath).catch((error: unknown) => {
      if (
        !(error instanceof Error && 'code' in error && error.code === 'ENOENT')
      )
        throw error;
    });
    await fs.rmdir(directory);
    cleaned = true;
  };
  retainCleanup(cleanup);
  stamp = await fs.lstat(directory, { bigint: true });
  const nonce = randomUUID();
  const media = JSON.stringify(pathToFileURL(candidate).href).replace(
    /</g,
    '\\u003c',
  );
  const script = `(${runCacheHardwareProbe.toString()})(${media},${JSON.stringify(mode)},${planCacheCompatibility.toString()});`;
  const html = `<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src 'none'; media-src file:; script-src 'nonce-${nonce}'"><video muted playsinline></video><script nonce="${nonce}">${script}</script>`;
  let window: BrowserWindow | undefined;
  let closing = false;
  let closed: Promise<void> = Promise.resolve();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let deadlineTimer: ReturnType<typeof setTimeout> | undefined;
  let rejectStop: (error: Error) => void = () => undefined;
  let stopError: Error | undefined;
  const stopped = new Promise<never>((_resolve, reject) => {
    rejectStop = (error) => {
      stopError = error;
      reject(error);
    };
  });
  // The handler may fire before an awaited operation is installed.
  void stopped.catch(() => undefined);
  const abort = (): void => rejectStop(new Error('CACHE_CANCELLED'));
  signal.addEventListener('abort', abort, { once: true });
  const wait = async <T>(work: Promise<T>): Promise<T> => {
    if (stopError) throw stopError;
    const result = await Promise.race([work, stopped]);
    if (stopError) throw stopError;
    if (performance.now() >= deadline) throw Error('CACHE_HARDWARE_TIMEOUT');
    return result;
  };
  deadlineTimer = setTimeout(
    () => rejectStop(new Error('CACHE_HARDWARE_TIMEOUT')),
    Math.max(0, deadline - performance.now()),
  );
  try {
    await fs.writeFile(htmlPath, html, { flag: 'wx', mode: 0o600 });
    signal.throwIfAborted();
    window = new BrowserWindow({
      show: false,
      width: 320,
      height: 180,
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        webSecurity: true,
        backgroundThrottling: false,
        autoplayPolicy: 'no-user-gesture-required',
        partition: 'cache-probe-' + nonce,
      },
    });
    const owned = window;
    closed = new Promise<void>((resolve) => owned.once('closed', resolve));
    owned.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    owned.webContents.session.setPermissionRequestHandler(
      (_contents, _permission, callback) => callback(false),
    );
    owned.webContents.session.setPermissionCheckHandler(() => false);
    owned.webContents.on('will-navigate', (event) => event.preventDefault());
    owned.webContents.on('will-redirect', (event) => event.preventDefault());
    owned.webContents.session.webRequest.onBeforeRequest(
      (details, callback) => {
        callback({
          cancel: ![
            'about:blank',
            pathToFileURL(htmlPath).href,
            pathToFileURL(candidate).href,
          ].includes(details.url),
        });
      },
    );
    const evidence = new CacheHardwareEvidence();
    owned.webContents.debugger.attach('1.3');
    owned.webContents.debugger.once('detach', () => {
      if (!closing) rejectStop(new Error('CACHE_HARDWARE_OBSERVER_LOST'));
    });
    owned.webContents.debugger.on('message', (_event, method, value: unknown) =>
      evidence.observe(method, value),
    );
    // Navigation must exist before awaiting debugger commands.
    await wait(owned.loadURL('about:blank'));
    await wait(owned.webContents.debugger.sendCommand('Media.enable'));
    await wait(owned.loadFile(htmlPath));
    while (performance.now() < deadline) {
      signal.throwIfAborted();
      if (owned.isDestroyed()) throw Error('CACHE_HARDWARE_WINDOW_CLOSED');
      const raw: unknown = await wait(
        owned.webContents.executeJavaScript('window.__cacheProbe'),
      );
      const state = objectValue(raw);
      booleanValue(state.ended);
      booleanValue(state.failed);
      if (state.failed) throw Error('CACHE_HARDWARE_PLAYBACK_FAILED');
      if (booleanValue(state.completed)) {
        const verified = readCacheHardwareCoverage(
          state,
          mode,
          presentationEnd,
        );
        return {
          ...evidence.finish(runtime),
          coverage: verified.coverage,
          probe: {
            ended: mode === 'full',
            frames: verified.frames,
            maximumTime: verified.maximumTime,
            elapsedMs: performance.now() - started,
            properties: evidence.snapshot(),
          },
        };
      }
      await delay(100, undefined, { signal });
    }
    throw Error('CACHE_HARDWARE_TIMEOUT');
  } finally {
    closing = true;
    signal.removeEventListener('abort', abort);
    clearTimeout(deadlineTimer);
    if (window && !window.isDestroyed()) {
      try {
        if (window.webContents.debugger.isAttached())
          window.webContents.debugger.detach();
      } catch {
        /* Detachment must never skip the owned window's close. */
      }
      window.close();
      timer = setTimeout(() => {
        try {
          stopWaiting(true);
        } catch {
          /* Observer does not own the window. */
        }
      }, 3000);
      await closed;
      clearTimeout(timer);
    }
    await cleanup();
  }
};
