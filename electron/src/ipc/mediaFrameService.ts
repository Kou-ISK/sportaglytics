import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { getFfprobePath } from '../mediaTools';
import { runMediaProcess } from './mediaProcessRunner';
import { isPlainObject } from './ipcPayloadGuards';

export interface MediaFrameWindow {
  times: number[];
  start: number;
  end: number;
}

const cache = new Map<string, Promise<MediaFrameWindow>>();

/** Decode a bounded neighbourhood, rather than assuming a constant frame rate. */
export const readMediaFrameWindow = async (
  source: string,
  time: number,
): Promise<MediaFrameWindow> => {
  if (
    !path.isAbsolute(source) ||
    !/\.(mp4|mov|m4v|webm)$/i.test(source) ||
    !Number.isFinite(time) ||
    time < 0 ||
    time > 86_400
  )
    throw new Error('INVALID_FRAME_REQUEST');
  const stat = await fs.stat(source);
  if (!stat.isFile()) throw new Error('INVALID_FRAME_SOURCE');
  const block = Math.floor(time / 4) * 4;
  const key = `${source}:${stat.size}:${stat.mtimeMs}:${block}`;
  const existing = cache.get(key);
  if (existing) return existing;
  const read = async (): Promise<MediaFrameWindow> => {
    const result = await runMediaProcess(
      getFfprobePath(),
      [
        '-v',
        'error',
        '-select_streams',
        'v:0',
        '-read_intervals',
        `${Math.max(0, block - 2)}%${block + 6}`,
        '-show_frames',
        '-show_entries',
        'frame=best_effort_timestamp_time',
        '-of',
        'json',
        source,
      ],
      { timeoutMs: 15_000, maxOutputBytes: 4 * 1024 * 1024 },
    );
    const parsed: unknown = JSON.parse(result.stdout);
    if (!isPlainObject(parsed) || !Array.isArray(parsed.frames))
      throw new Error('INVALID_FRAME_TIMESTAMPS');
    const times = [
      ...new Set(
        parsed.frames.flatMap((frame: unknown) => {
          if (!isPlainObject(frame)) return [];
          const pts = Number(frame.best_effort_timestamp_time);
          return Number.isFinite(pts) && pts >= 0 ? [pts] : [];
        }),
      ),
    ].sort((a, b) => a - b);
    if (!times.length) throw new Error('FRAME_TIMESTAMPS_UNAVAILABLE');
    return { times, start: block, end: block + 4 };
  };
  const pending = read().catch((error: unknown) => {
    cache.delete(key);
    throw error;
  });
  cache.set(key, pending);
  if (cache.size > 24) cache.delete(cache.keys().next().value ?? '');
  return pending;
};
