import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import type { BrowserWindow } from 'electron';
import type {
  PlaybackCacheSnapshot,
  PlaybackCacheRequest,
  PlaybackCacheCandidate,
  PlaybackCacheSelection,
} from '../../../src/types/ipc/playbackCache';
import type { PlaybackCacheStatus } from '../../../src/types/playbackCache';
import { getPackageSessionForWindow } from '../packageSessionRegistry';
import { resolveCacheSource } from './cacheSourceAccess';
import type { CacheAuthorizedSource } from './cacheSourceAccess';
import { preparePlaybackCache, CACHE_LIMITS } from './cacheRuntimePipeline';
import type { CachePreparedArtifact } from './cacheRuntimePipeline';
import type { PlaybackCacheJob } from './cacheJob';
import { identifyCacheSource, readCacheFileIdentity } from './sourceIdentity';

const controllers = new Map<BrowserWindow, CacheSessionController>();
const heldWindows = new Set<BrowserWindow>();
let quitting = false;
const active = new Set<CacheSessionController>();
const original = (): PlaybackCacheStatus => ({
  phase: 'original',
  progress: null,
  selected: 'original',
  error: null,
});

/** Main retains all operation ownership through document loss and shutdown. */
export class CacheSessionController {
  private generation = randomUUID();
  private packagePath: string | null = null;
  private source: CacheAuthorizedSource | null = null;
  private state = original();
  private abort: AbortController | null = null;
  private operation: Promise<unknown> | null = null;
  private job: PlaybackCacheJob | null = null;
  private artifact: CachePreparedArtifact | null = null;
  private ticket: string | null = null;
  private sourceLookup: Promise<void> | null = null;
  constructor(private readonly window: BrowserWindow) {
    window.webContents.on('did-start-navigation', (details) => {
      if (details.isMainFrame && !details.isSameDocument) this.invalidate(null);
    });
    window.webContents.on('render-process-gone', () => this.invalidate(null));
    window.once('closed', () => {
      this.invalidate(null);
      void this.drain().then(() => {
        if (this.state.error !== 'cleanup') controllers.delete(window);
      });
    });
  }
  private invalidate(location: string | null): void {
    this.generation = randomUUID();
    this.abort?.abort();
    this.job?.useOriginal();
    this.source = null;
    this.artifact = null;
    this.ticket = null;
    this.packagePath = location;
    if (!this.operation && this.state.error !== 'cleanup')
      this.state = original();
  }
  private async owner(generation: string, packagePath: string): Promise<void> {
    const session = getPackageSessionForWindow(this.window);
    if (
      this.window.isDestroyed() ||
      generation !== this.generation ||
      !session?.packageBound ||
      session.mainWindow !== this.window ||
      session.packagePath !== packagePath
    )
      throw Error('CACHE_OWNER_CHANGED');
  }
  async inspect(): Promise<PlaybackCacheSnapshot> {
    const session = getPackageSessionForWindow(this.window);
    const location =
      session?.packageBound && session.mainWindow === this.window
        ? session.packagePath
        : null;
    if (location !== this.packagePath) this.invalidate(location);
    if (location && !this.operation && !this.sourceLookup) {
      const generation = this.generation;
      this.sourceLookup = (async () => {
        try {
          if (this.source) await this.source.assertCurrent();
          else {
            const source = await resolveCacheSource(location);
            await this.owner(generation, location);
            this.source = source;
          }
        } catch {
          if (generation === this.generation && this.source)
            this.invalidate(location);
        }
      })().finally(() => {
        this.sourceLookup = null;
      });
    }
    await this.sourceLookup;
    return {
      generation: this.generation,
      source: this.source
        ? {
            key: this.source.key,
            url: this.source.url,
            label: this.source.label,
            audioTracks: this.artifact?.audioTracks ?? null,
          }
        : null,
      status: [...controllers.values()].some(
        (controller) =>
          controller.window.isDestroyed() &&
          controller.state.error === 'cleanup',
      )
        ? { ...original(), phase: 'failed', error: 'cleanup' }
        : { ...this.state },
      available:
        process.platform === 'darwin' &&
        !!this.source &&
        !this.operation &&
        !quitting &&
        !heldWindows.has(this.window) &&
        active.size === 0 &&
        this.state.error !== 'cleanup' &&
        this.state.selected !== 'cache',
      maximumCacheBytes: CACHE_LIMITS.maximumCacheBytes,
      reserveBytes: CACHE_LIMITS.reserveBytes,
    };
  }
  private request(value: PlaybackCacheRequest): CacheAuthorizedSource {
    if (
      value.generation !== this.generation ||
      !this.source ||
      value.sourceKey !== this.source.key
    )
      throw Error('CACHE_STALE_REQUEST');
    const session = getPackageSessionForWindow(this.window);
    if (
      this.window.isDestroyed() ||
      !session?.packageBound ||
      session.mainWindow !== this.window ||
      session.packagePath !== this.packagePath
    )
      throw Error('CACHE_OWNER_CHANGED');
    return this.source;
  }
  private async run<T>(work: (signal: AbortSignal) => Promise<T>): Promise<T> {
    if (this.operation || quitting || heldWindows.has(this.window))
      throw Error('CACHE_BUSY');
    const abort = new AbortController();
    this.abort = abort;
    const generation = this.generation;
    // Defer work until ownership is installed, including a synchronous rejection.
    const operation = Promise.resolve().then(() => work(abort.signal));
    this.operation = operation;
    try {
      return await operation;
    } finally {
      this.abort = null;
      this.operation = null;
      if (generation !== this.generation && this.state.error !== 'cleanup')
        this.state = original();
    }
  }
  prepare(value: PlaybackCacheRequest): void {
    const source = this.request(value);
    const packagePath = this.packagePath;
    if (
      !packagePath ||
      this.operation ||
      active.size > 0 ||
      quitting ||
      heldWindows.has(this.window) ||
      this.state.error === 'cleanup' ||
      this.state.selected === 'cache'
    )
      throw Error('CACHE_BUSY');
    const generation = this.generation;
    active.add(this);
    this.artifact = null;
    this.ticket = null;
    this.job = null;
    this.state = { ...original(), phase: 'validating' };
    void this.run(async (signal) => {
      try {
        const artifact = await preparePlaybackCache({
          source,
          signal,
          assertOwner: () => this.owner(generation, packagePath),
          notify: (status) => {
            this.state = { ...status };
          },
          retainJob: (job) => {
            this.job = job;
          },
        });
        if (generation === this.generation) this.artifact = artifact;
      } catch {
        if (this.job?.status.error === 'cleanup') this.state = this.job.status;
        else if (signal.aborted) this.state = original();
        else
          this.state =
            this.job?.status.phase === 'failed'
              ? this.job.status
              : { ...original(), phase: 'failed', error: 'validation' };
      } finally {
        active.delete(this);
      }
    }).catch(() => {
      active.delete(this);
    });
  }
  cancel(value: PlaybackCacheRequest): void {
    this.request(value);
    this.ticket = null;
    this.abort?.abort();
    this.job?.cancel();
  }
  async cleanup(value: PlaybackCacheRequest): Promise<void> {
    this.request(value);
    await this.run(async () => {
      for (const controller of controllers.values()) {
        if (
          controller.window.isDestroyed() &&
          controller.state.error === 'cleanup'
        ) {
          await controller.job?.retryCleanup();
          if (controller.job?.status.error !== 'cleanup')
            controllers.delete(controller.window);
        }
      }
      await this.job?.retryCleanup();
      if (this.job) this.state = this.job.status;
    });
  }
  async candidate(
    value: PlaybackCacheRequest,
  ): Promise<PlaybackCacheCandidate> {
    const source = this.request(value);
    const artifact = this.artifact;
    const location = this.packagePath;
    if (!artifact || !location || this.state.selected === 'cache')
      throw Error('CACHE_NOT_READY');
    this.ticket = null;
    return this.run(async (signal) => {
      await source.assertCurrent();
      const input = await identifyCacheSource(source.path, { signal });
      const output = await readCacheFileIdentity(artifact.candidate.mediaPath, {
        signal,
      });
      await this.owner(value.generation, location);
      await source.assertCurrent();
      signal.throwIfAborted();
      if (
        input.sha256 !== artifact.expectation.source.sha256 ||
        output.identity.sha256 !== artifact.candidate.sha256
      )
        throw Error('CACHE_CHANGED');
      this.ticket = randomUUID();
      return {
        url: pathToFileURL(artifact.candidate.mediaPath).href,
        ticket: this.ticket,
        audioTracks: artifact.audioTracks,
      };
    });
  }
  async selected(value: PlaybackCacheSelection): Promise<void> {
    const source = this.request(value);
    if (value.ticket === null) {
      this.ticket = null;
      this.job?.useOriginal();
      this.state = { ...this.state, selected: 'original' };
      return;
    }
    const location = this.packagePath;
    if (!location || value.ticket !== this.ticket || !this.artifact)
      throw Error('CACHE_STALE_REQUEST');
    await this.run(async (signal) => {
      await source.assertCurrent();
      await this.owner(value.generation, location);
      signal.throwIfAborted();
      if (value.ticket !== this.ticket || !this.job?.selectCache(true))
        throw Error('CACHE_NOT_READY');
      this.ticket = null;
      this.state = { ...this.state, selected: 'cache' };
    });
  }
  get cleanupRequired(): boolean {
    return this.state.error === 'cleanup';
  }
  async drain(): Promise<void> {
    this.abort?.abort();
    this.job?.cancel();
    try {
      await this.operation;
    } catch {
      /* Caller reports errors; ownership still drains. */
    }
  }
}
export const getCacheSessionController = (
  window: BrowserWindow,
): CacheSessionController => {
  let controller = controllers.get(window);
  if (!controller) {
    controller = new CacheSessionController(window);
    controllers.set(window, controller);
  }
  return controller;
};
/** A close transaction keeps creation blocked until close succeeds or resumes.
 * Quit also drains controllers whose renderer/window disappeared unexpectedly. */
export const holdPlaybackCaches = async (
  windows: readonly BrowserWindow[],
  kind: 'close' | 'quit',
): Promise<() => void> => {
  if (kind === 'quit') quitting = true;
  else windows.forEach((window) => heldWindows.add(window));
  const targets =
    kind === 'quit'
      ? [...controllers.values()]
      : windows.flatMap((window) => {
          const value = controllers.get(window);
          return value ? [value] : [];
        });
  const release = (): void => {
    if (kind === 'quit') quitting = false;
    else windows.forEach((window) => heldWindows.delete(window));
  };
  try {
    await Promise.all(targets.map((controller) => controller.drain()));
    if (targets.some((controller) => controller.cleanupRequired))
      throw Error('CACHE_CLEANUP_REQUIRED');
    return release;
  } catch (error) {
    release();
    throw error;
  }
};
