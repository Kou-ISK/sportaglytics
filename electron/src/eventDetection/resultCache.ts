import { createHash } from 'node:crypto';
import { lstat, readdir } from 'node:fs/promises';
import * as path from 'node:path';
import type {
  EventDetectionRequest,
  EventDetectionResult,
} from '../../../src/types/eventDetection/core';
import type { RunnableEventDetectionModel } from './types';

const MAX_MODEL_ENTRIES = 1024;

/** A metadata change invalidates reuse even when a model version is unchanged. */
export const eventDetectionCacheKey = async (
  model: RunnableEventDetectionModel,
  request: EventDetectionRequest,
): Promise<string | undefined> => {
  const files: string[] = [];
  let count = 0;
  const describe = async (
    filePath: string,
    recursive: boolean,
  ): Promise<void> => {
    if (++count > MAX_MODEL_ENTRIES)
      throw new Error('Model is too large to cache');
    const info = await lstat(filePath, { bigint: true });
    if (info.isSymbolicLink())
      throw new Error('Symlinked inputs are not cached');
    files.push(
      [
        filePath,
        info.dev,
        info.ino,
        info.size,
        info.mtimeNs,
        info.ctimeNs,
      ].join(':'),
    );
    if (info.isDirectory() && recursive) {
      const entries = (await readdir(filePath)).sort();
      for (const entry of entries)
        await describe(path.join(filePath, entry), true);
    } else if (!info.isFile()) {
      throw new Error('Cache input is not a regular file');
    }
  };
  try {
    await describe(model.modelDirectory, true);
    for (const clip of request.clips) await describe(clip.videoPath, false);
  } catch {
    // Caching is optional. Normal input/process validation remains authoritative.
    return undefined;
  }
  return createHash('sha256')
    .update(
      JSON.stringify({
        model: model.info,
        runnerPath: model.runnerPath,
        runnerSha256: model.runnerSha256,
        events: request.events,
        clips: request.clips,
        files,
      }),
    )
    .digest('hex');
};

interface CacheEntry {
  result: EventDetectionResult;
  bytes: number;
  createdAt: number;
}

/** Process-local only: no video paths or predictions are persisted to disk. */
export class EventDetectionResultCache {
  private readonly entries = new Map<string, CacheEntry>();
  private bytes = 0;

  constructor(
    private readonly maximumBytes = 20 * 1024 * 1024,
    private readonly maximumEntries = 4,
    private readonly lifetimeMs = 30 * 60 * 1000,
  ) {}

  get(
    key: string | undefined,
    requestId: string,
  ): EventDetectionResult | undefined {
    if (!key) return undefined;
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (Date.now() - entry.createdAt >= this.lifetimeMs) {
      this.remove(key);
      return undefined;
    }
    this.entries.delete(key);
    this.entries.set(key, entry);
    return { ...structuredClone(entry.result), requestId, durationMs: 0 };
  }

  set(key: string | undefined, result: EventDetectionResult): void {
    if (!key) return;
    const bytes = Buffer.byteLength(JSON.stringify(result));
    if (bytes > this.maximumBytes) return;
    this.remove(key);
    while (
      this.entries.size >= this.maximumEntries ||
      this.bytes + bytes > this.maximumBytes
    ) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) return;
      this.remove(oldest);
    }
    this.entries.set(key, {
      result: structuredClone(result),
      bytes,
      createdAt: Date.now(),
    });
    this.bytes += bytes;
  }

  private remove(key: string): void {
    const entry = this.entries.get(key);
    if (entry) this.bytes -= entry.bytes;
    this.entries.delete(key);
  }
}
