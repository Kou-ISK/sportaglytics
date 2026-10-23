import { BrowserWindow } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import {
  objectValue,
  stringValue,
  booleanValue,
  integerValue,
  numberValue,
  arrayValue,
} from '../../../src/shared/validation/jsonValues';
import type { CacheValidation } from './cachePolicy';

export class CacheHardwareEvidence {
  private readonly players = new Set<string>();
  private platform = false;
  private decoder = false;
  private failed = false;
  observe(method: string, value: unknown): void {
    if (method === 'Media.playerErrorsRaised') this.failed = true;
    if (method !== 'Media.playerPropertiesChanged') return;
    try {
      const v = objectValue(value);
      const playerId = stringValue(v.playerId);
      const properties = arrayValue(v.properties, 0, 128).map((property) => {
        const p = objectValue(property);
        return { name: stringValue(p.name), value: stringValue(p.value) };
      });
      this.players.add(playerId);
      for (const property of properties) {
        if (property.name === 'kIsPlatformVideoDecoder') {
          if (property.value === 'true') this.platform = true;
          else this.failed = true;
        }
        if (property.name === 'kVideoDecoderName') {
          if (property.value === 'VideoToolboxVideoDecoder')
            this.decoder = true;
          else this.failed = true;
        }
      }
    } catch {
      this.failed = true;
    }
  }

  finish(runtime: string): CacheValidation['hardware'] {
    if (
      this.players.size !== 1 ||
      !this.platform ||
      !this.decoder ||
      this.failed
    )
      throw Error('CACHE_HARDWARE_UNCONFIRMED');
    return { runtime, platformDecoder: true, softwareFallback: false };
  }
}
/** Decode this exact candidate to its end in the same Electron runtime.
 * Isolated, muted, local-only, no preload, no IPC, no network or external port.
 * This proves the bounded probe, not long-video playback or physical scrub. */
export const probeCacheHardware = async (
  candidate: string,
  privateDirectory: string,
  runtime: string,
  signal: AbortSignal,
  stopWaiting: (unconfirmed: boolean) => void,
  retainCleanup: (cleanup: () => Promise<void>) => void,
): Promise<CacheValidation['hardware']> => {
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
  const html =
    '<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; media-src file:; script-src \'nonce-' +
    nonce +
    '\'"><video muted playsinline></video><script nonce="' +
    nonce +
    '">' +
    'window.__cacheProbe={ended:false,failed:false,frames:0,maximumTime:0};' +
    'const video=document.querySelector("video");video.muted=true;video.src=' +
    media +
    ';' +
    'const frame=(_now,m)=>{window.__cacheProbe.frames++;window.__cacheProbe.maximumTime=Math.max(window.__cacheProbe.maximumTime,m.mediaTime);if(!video.ended)video.requestVideoFrameCallback(frame);};' +
    'video.requestVideoFrameCallback(frame);video.onended=()=>{window.__cacheProbe.ended=true;};' +
    'video.onerror=()=>{window.__cacheProbe.failed=true;};' +
    'video.play().catch(()=>{window.__cacheProbe.failed=true;});</script>';
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
    return result;
  };
  deadlineTimer = setTimeout(
    () => rejectStop(new Error('CACHE_HARDWARE_TIMEOUT')),
    150000,
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
    const deadline = Date.now() + 150000;
    while (Date.now() < deadline) {
      signal.throwIfAborted();
      if (owned.isDestroyed()) throw Error('CACHE_HARDWARE_WINDOW_CLOSED');
      const raw: unknown = await wait(
        owned.webContents.executeJavaScript('window.__cacheProbe'),
      );
      const state = objectValue(raw);
      booleanValue(state.ended);
      booleanValue(state.failed);
      if (state.failed) throw Error('CACHE_HARDWARE_PLAYBACK_FAILED');
      if (state.ended) {
        integerValue(state.frames, 1);
        if (numberValue(state.maximumTime) <= 0)
          throw Error('CACHE_HARDWARE_NO_FRAMES');
        return evidence.finish(runtime);
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
