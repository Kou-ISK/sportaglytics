import { CacheRangeFailure } from './cacheRangeFailure';
import fs from 'node:fs/promises';
import type { FileHandle } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { cacheFileRevision } from './cacheFileRevision';

export type CacheRangeId = 'initialization' | number;
export interface CacheRangeReadScope {
  session: string;
  source: string;
  worker: string;
  build: string;
  recipe: string;
}
export interface CacheRangeReadArtifact {
  path: string;
  revision: string;
  bytes: number;
  ranges: {
    id: CacheRangeId;
    offset: number;
    bytes: number;
    sha256: string;
  }[];
}
export interface CacheRangeReadManifest {
  scope: CacheRangeReadScope;
  artifacts: CacheRangeReadArtifact[];
}
export interface CacheRangeReadTicket {
  readonly kind: 'verified-range-read-ticket';
}
interface OpenArtifact {
  manifest: CacheRangeReadArtifact;
  handle: FileHandle;
  closed: boolean;
}
const sameScope = (a: CacheRangeReadScope, b: CacheRangeReadScope): boolean =>
  (['session', 'source', 'worker', 'build', 'recipe'] as const).every(
    (key) =>
      typeof a[key] === 'string' && a[key].length > 0 && a[key] === b[key],
  );
const positive = (n: number): boolean => Number.isSafeInteger(n) && n > 0;

/** Main-only byte capability. Issuance is not media validation: the trusted
 * verifier must await actual worker close, complete decoded/AAC/mapping/HW
 * checks, and bind these exact final ranges before returning its manifest.
 * No IPC accepts a manifest or a path. Ticket identity is local to this owner. */
export class CacheRangeReadOwner {
  private readonly scope: CacheRangeReadScope;
  private readonly abort = new AbortController();
  private readonly signal: AbortSignal;
  private readonly tickets = new Map<
    CacheRangeReadTicket,
    CacheRangeReadManifest
  >();
  private readonly leases = new Set<CacheRangeReadLease>();
  private preparing: Promise<CacheRangeReadTicket> | null = null;
  private closing: Promise<void> | null = null;
  private retained = 0;
  constructor(
    scope: CacheRangeReadScope,
    signal: AbortSignal,
    private readonly assertCurrent: () => Promise<void>,
    private readonly limitBytes = 128 * 1024 * 1024,
  ) {
    if (!sameScope(scope, scope) || !positive(limitBytes))
      throw Error('RANGE_READ_SCOPE');
    this.scope = { ...scope };
    this.signal = AbortSignal.any([signal, this.abort.signal]);
  }
  get retainedBytes(): number {
    return this.retained;
  }
  private async current(): Promise<void> {
    this.signal.throwIfAborted();
    await this.assertCurrent();
    this.signal.throwIfAborted();
  }
  private validate(value: CacheRangeReadManifest): number {
    if (
      !sameScope(value.scope, this.scope) ||
      !value.artifacts.length ||
      value.artifacts.length > 16
    )
      throw Error('RANGE_READ_MANIFEST');
    const ids = new Set<CacheRangeId>(),
      paths = new Set<string>();
    let total = 0;
    for (const file of value.artifacts) {
      if (
        !path.isAbsolute(file.path) ||
        paths.has(file.path) ||
        !file.revision ||
        !positive(file.bytes) ||
        !file.ranges.length
      )
        throw Error('RANGE_READ_MANIFEST');
      paths.add(file.path);
      total += file.bytes;
      for (const range of file.ranges) {
        if (
          (range.id !== 'initialization' &&
            (!Number.isSafeInteger(range.id) || range.id < 0)) ||
          ids.has(range.id) ||
          ids.size >= 64 ||
          !Number.isSafeInteger(range.offset) ||
          range.offset < 0 ||
          !positive(range.bytes) ||
          range.bytes > 64 * 1024 * 1024 ||
          !Number.isSafeInteger(range.offset + range.bytes) ||
          range.offset + range.bytes > file.bytes ||
          !/^[a-f0-9]{64}$/.test(range.sha256)
        )
          throw Error('RANGE_READ_MANIFEST');
        ids.add(range.id);
      }
    }
    if (!Number.isSafeInteger(total) || total > this.limitBytes)
      throw Error('RANGE_READ_CAPACITY');
    return total;
  }
  prepare(
    verify: () => Promise<CacheRangeReadManifest>,
  ): Promise<CacheRangeReadTicket> {
    if (this.preparing || this.tickets.size >= 2)
      return Promise.reject(Error('RANGE_READ_BUSY'));
    this.preparing = (async () => {
      await this.current();
      const manifest = structuredClone(await verify());
      this.validate(manifest);
      await this.current();
      const ticket: CacheRangeReadTicket = Object.freeze({
        kind: 'verified-range-read-ticket',
      });
      this.tickets.set(ticket, manifest);
      return ticket;
    })();
    const result = this.preparing;
    void result
      .finally(() => {
        this.preparing = null;
      })
      .catch(() => undefined);
    return result;
  }
  async redeem(ticket: CacheRangeReadTicket): Promise<CacheRangeReadLease> {
    this.signal.throwIfAborted();
    const manifest = this.tickets.get(ticket);
    if (!manifest) throw Error('RANGE_READ_TICKET');
    this.tickets.delete(ticket);
    const bytes = this.validate(manifest);
    if (this.retained + bytes > this.limitBytes)
      throw Error('RANGE_READ_CAPACITY');
    this.retained += bytes;
    const lease = new CacheRangeReadLease(
      manifest,
      this.signal,
      () => this.current(),
      () => {
        this.retained -= bytes;
        this.leases.delete(lease);
      },
    );
    this.leases.add(lease);
    try {
      await lease.open();
      await this.current();
      return lease;
    } catch (error) {
      try {
        await lease.close();
      } catch (closeError) {
        throw new CacheRangeFailure('RANGE_READ_CLEANUP', [error, closeError]);
      }
      throw error;
    }
  }
  close(): Promise<void> {
    if (this.closing) return this.closing;
    this.abort.abort(Error('RANGE_READ_REVOKED'));
    this.tickets.clear();
    this.closing = (async () => {
      await this.preparing?.catch(() => undefined);
      const results = await Promise.allSettled(
        [...this.leases].map((lease) => lease.close()),
      );
      const errors = results
        .filter((r) => r.status === 'rejected')
        .map((r) => r.reason);
      if (errors.length)
        throw new CacheRangeFailure('RANGE_READ_CLEANUP', errors);
    })();
    return this.closing;
  }
}

/** A redeemed lease allows repeat reads for backward seek, but only one
 * bounded read at a time. Bytes are re-hashed before each delivery. */
class CacheRangeReadLease {
  private readonly opened: OpenArtifact[] = [];
  private opening: Promise<void> | null = null;
  private active: Promise<ArrayBuffer> | null = null;
  private closing: Promise<void> | null = null;
  private failed = false;
  private stopped = false;
  constructor(
    private readonly manifest: CacheRangeReadManifest,
    private readonly signal: AbortSignal,
    private readonly current: () => Promise<void>,
    private readonly released: () => void,
  ) {}
  private async check(): Promise<void> {
    if (this.stopped || this.failed) throw Error('RANGE_READ_UNAVAILABLE');
    this.signal.throwIfAborted();
    await this.current();
    this.signal.throwIfAborted();
    if (this.stopped || this.failed) throw Error('RANGE_READ_UNAVAILABLE');
  }
  private async revision(file: OpenArtifact): Promise<void> {
    const actual = await file.handle.stat({ bigint: true });
    const located = await fs.lstat(file.manifest.path, { bigint: true });
    if (
      !located.isFile() ||
      located.isSymbolicLink() ||
      located.nlink !== 1n ||
      actual.size !== BigInt(file.manifest.bytes) ||
      cacheFileRevision(actual) !== file.manifest.revision ||
      cacheFileRevision(located) !== file.manifest.revision
    )
      throw Error('RANGE_READ_CHANGED');
  }
  open(): Promise<void> {
    if (this.opening) return this.opening;
    this.opening = (async () => {
      for (const manifest of this.manifest.artifacts) {
        await this.check();
        const handle = await fs.open(
          manifest.path,
          fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW,
        );
        const file = { manifest, handle, closed: false };
        this.opened.push(file);
        await this.check();
        await this.revision(file);
        await this.check();
      }
    })();
    return this.opening;
  }
  read(id: CacheRangeId, signal: AbortSignal): Promise<ArrayBuffer> {
    if (this.active) return Promise.reject(Error('RANGE_READ_BUSY'));
    this.active = (async () => {
      await this.opening;
      await this.check();
      signal.throwIfAborted();
      const file = this.opened.find((f) =>
        f.manifest.ranges.some((r) => r.id === id),
      );
      const range = file?.manifest.ranges.find((r) => r.id === id);
      if (!file || !range) throw Error('RANGE_READ_ID');
      await this.revision(file);
      await this.check();
      signal.throwIfAborted();
      const bytes = Buffer.alloc(range.bytes);
      let offset = 0;
      while (offset < bytes.length) {
        const part = await file.handle.read(
          bytes,
          offset,
          Math.min(1024 * 1024, bytes.length - offset),
          range.offset + offset,
        );
        await this.check();
        signal.throwIfAborted();
        if (!part.bytesRead) throw Error('RANGE_READ_TRUNCATED');
        offset += part.bytesRead;
      }
      if (createHash('sha256').update(bytes).digest('hex') !== range.sha256)
        throw Error('RANGE_READ_HASH');
      await this.revision(file);
      await this.check();
      signal.throwIfAborted();
      return new Uint8Array(bytes).buffer;
    })().catch((error) => {
      this.failed = true;
      throw error;
    });
    const result = this.active;
    void result
      .finally(() => {
        this.active = null;
      })
      .catch(() => undefined);
    return result;
  }
  close(): Promise<void> {
    if (this.closing) return this.closing;
    this.stopped = true;
    this.closing = (async () => {
      await this.opening?.catch(() => undefined);
      await this.active?.catch(() => undefined);
      const errors: unknown[] = [];
      for (const file of this.opened) {
        if (file.closed) continue;
        try {
          await file.handle.close();
          file.closed = true;
        } catch (error) {
          errors.push(error);
        }
      }
      if (errors.length)
        throw new CacheRangeFailure('RANGE_READ_CLOSE', errors);
      this.released();
    })();
    return this.closing;
  }
}
