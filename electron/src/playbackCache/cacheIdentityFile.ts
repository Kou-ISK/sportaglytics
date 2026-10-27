import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import type { FileHandle } from 'node:fs/promises';
import type { BigIntStats } from 'node:fs';
import type { CacheSourceIdentity } from './cachePolicy';
import { cacheFileRevision } from './cacheFileRevision';

export interface CacheFileIdentity {
  identity: CacheSourceIdentity;
  revision: string;
}
export interface CacheIdentityRead {
  bytes: number;
  verified: boolean;
  elapsedMs: number;
}
export type CacheIdentityReadObserver = (
  path: string,
  read: CacheIdentityRead,
) => void;
export interface CacheIdentityOptions {
  signal?: AbortSignal;
  progress?: (bytes: number, total: number) => void;
  observe?: CacheIdentityReadObserver;
  singleLink?: boolean;
}
/** Owns one open/read/check/close lifecycle. Close errors stay latched until an
 * explicit cleanup retry; never reissue close by an unowned numeric fd. */
export class CacheIdentityFile {
  private handle: FileHandle | null = null;
  private before: BigIntStats | null = null;
  private value: CacheFileIdentity | null = null;
  private reading: Promise<CacheFileIdentity> | null = null;
  private checking: Promise<CacheFileIdentity> | null = null;
  private closing: Promise<void> | null = null;
  private closeRequested = false;
  private closed = false;
  private closeError: unknown;
  private closeFailed = false;
  constructor(
    private readonly source: string,
    private readonly options: CacheIdentityOptions,
  ) {}
  private checkSignal(signal?: AbortSignal): void {
    this.options.signal?.throwIfAborted();
    signal?.throwIfAborted();
    if (this.closeRequested) throw Error('CACHE_IDENTITY_CLOSED');
  }
  private async step<T>(
    work: () => Promise<T>,
    signal?: AbortSignal,
  ): Promise<T> {
    this.checkSignal(signal);
    const result = await work();
    this.checkSignal(signal);
    return result;
  }
  read(): Promise<CacheFileIdentity> {
    if (this.reading || this.closeRequested)
      return Promise.reject(Error('CACHE_IDENTITY_USED'));
    this.reading = this.hash();
    return this.reading;
  }
  private async hash(): Promise<CacheFileIdentity> {
    const started = performance.now();
    let bytes = 0,
      verified = false;
    try {
      this.checkSignal();
      const before = await this.step(() =>
        fs.lstat(this.source, { bigint: true }),
      );
      if (
        !before.isFile() ||
        before.isSymbolicLink() ||
        before.size <= 0n ||
        before.size > BigInt(Number.MAX_SAFE_INTEGER) ||
        (this.options.singleLink && before.nlink !== 1n)
      )
        throw Error('CACHE_INVALID_SOURCE');
      this.before = before;
      this.checkSignal();
      // Install the handle before checking cancellation after an uncancellable open.
      const handle = await fs.open(
        this.source,
        fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW,
      );
      this.handle = handle;
      this.checkSignal();
      const opened = await this.step(() => handle.stat({ bigint: true }));
      if (cacheFileRevision(before) !== cacheFileRevision(opened))
        throw Error('CACHE_SOURCE_CHANGED');
      const digest = createHash('sha256'),
        buffer = Buffer.allocUnsafe(1024 * 1024);
      while (true) {
        this.checkSignal();
        const part = await handle.read(buffer, 0, buffer.length, bytes);
        // Count delivered bytes even when cancellation arrived during this read.
        bytes += part.bytesRead;
        this.checkSignal();
        if (!part.bytesRead) break;
        if (BigInt(bytes) > before.size) throw Error('CACHE_SOURCE_CHANGED');
        digest.update(buffer.subarray(0, part.bytesRead));
        try {
          this.options.progress?.(bytes, Number(before.size));
        } catch {
          /* Advisory only. */
        }
      }
      await this.verifyRevision();
      if (BigInt(bytes) !== before.size) throw Error('CACHE_SOURCE_CHANGED');
      this.value = {
        identity: { sha256: digest.digest('hex'), bytes },
        revision: cacheFileRevision(before),
      };
      verified = true;
      return structuredClone(this.value);
    } finally {
      try {
        this.options.observe?.(this.source, {
          bytes,
          verified,
          elapsedMs: performance.now() - started,
        });
      } catch {
        /* Measurement cannot alter the digest or its cleanup. */
      }
    }
  }
  private async verifyRevision(signal?: AbortSignal): Promise<void> {
    const handle = this.handle,
      before = this.before;
    if (!handle || !before) throw Error('CACHE_IDENTITY_MISSING');
    const after = await this.step(() => handle.stat({ bigint: true }), signal);
    const located = await this.step(
      () => fs.lstat(this.source, { bigint: true }),
      signal,
    );
    if (
      !located.isFile() ||
      located.isSymbolicLink() ||
      cacheFileRevision(before) !== cacheFileRevision(after) ||
      cacheFileRevision(before) !== cacheFileRevision(located)
    )
      throw Error('CACHE_SOURCE_CHANGED');
  }
  current(signal: AbortSignal): Promise<CacheFileIdentity> {
    if (!this.value || this.checking || this.closeRequested)
      return Promise.reject(Error('CACHE_IDENTITY_UNAVAILABLE'));
    this.checking = (async () => {
      await this.verifyRevision(signal);
      this.checkSignal(signal);
      if (!this.value) throw Error('CACHE_IDENTITY_MISSING');
      return structuredClone(this.value);
    })();
    return this.checking;
  }
  close(retryFailed = false): Promise<void> {
    this.closeRequested = true;
    if (this.closing) return this.closing;
    if (this.closed) return Promise.resolve();
    if (this.closeFailed && !retryFailed)
      return Promise.reject(this.closeError);
    this.closing = (async () => {
      await this.reading?.catch(() => undefined);
      await this.checking?.catch(() => undefined);
      try {
        await this.handle?.close();
        this.closed = true;
        this.closeError = undefined;
        this.closeFailed = false;
      } catch (error) {
        this.closeError = error;
        this.closeFailed = true;
        throw error;
      } finally {
        this.closing = null;
      }
    })();
    return this.closing;
  }
}
