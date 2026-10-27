import { CacheIdentityFile } from './cacheIdentityFile';
import type {
  CacheFileIdentity,
  CacheIdentityReadObserver,
} from './cacheIdentityFile';
/** Single-use Main operation capability, never persisted or exposed to Renderer. */
export class CacheIdentityHandoff {
  private file: CacheIdentityFile | null = null;
  private path: string | null = null;
  private worker: AbortSignal | null = null;
  private captured = false;
  private consumed = false;
  private closed = false;
  constructor(
    private readonly signal: AbortSignal,
    private readonly observe?: CacheIdentityReadObserver,
  ) {}
  async capture(path: string, worker: AbortSignal): Promise<CacheFileIdentity> {
    this.signal.throwIfAborted();
    worker.throwIfAborted();
    if (this.file || this.closed) throw Error('CACHE_HANDOFF_USED');
    this.path = path;
    this.worker = worker;
    this.file = new CacheIdentityFile(path, {
      signal: AbortSignal.any([this.signal, worker]),
      observe: this.observe,
      singleLink: true,
    });
    const identity = await this.file.read();
    this.signal.throwIfAborted();
    worker.throwIfAborted();
    if (this.closed) throw Error('CACHE_HANDOFF_CLOSED');
    this.captured = true;
    return identity;
  }
  async consume(path: string, worker: AbortSignal): Promise<CacheFileIdentity> {
    this.signal.throwIfAborted();
    worker.throwIfAborted();
    if (
      !this.file ||
      !this.captured ||
      this.consumed ||
      this.closed ||
      worker !== this.worker ||
      path !== this.path
    )
      throw Error('CACHE_HANDOFF_UNAVAILABLE');
    this.consumed = true;
    try {
      return await this.file.current(AbortSignal.any([this.signal, worker]));
    } finally {
      await this.close();
    }
  }
  close(retryFailed = false): Promise<void> {
    this.closed = true;
    return this.file?.close(retryFailed) ?? Promise.resolve();
  }
}
