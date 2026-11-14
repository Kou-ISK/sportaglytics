import { lstat } from 'node:fs/promises';
import { getFfprobePath } from '../mediaTools';
import { runNativeExportProbe, NativeExportCapacityError } from './nativeExportProcess';
import type { NativeClipExportRequest } from './nativeClipExport';

export class NativeExportSourceChanged extends Error {
  constructor() { super('Source changed during estimation'); this.name = 'NativeExportSourceChanged'; }
}

const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const positive = (v: unknown): number => typeof v === 'string' || typeof v === 'number' ? Number(v) : NaN;

/** Estimate selected streams only. This is an admission estimate, never a disk reservation. */
export const estimateNativeBytes = (metadata: unknown, request: NativeClipExportRequest, sourceBytes: number): number => {
  if (!record(metadata) || !Array.isArray(metadata.streams) || !metadata.streams.every(record)) throw new NativeExportCapacityError('Cannot estimate native export streams');
  const videos = metadata.streams.filter((s) => s.codec_type === 'video');
  const audios = metadata.streams.filter((s) => s.codec_type === 'audio');
  const audio = audios[request.audioTrack];
  if (videos.length !== 1 || !audio || !Number.isFinite(request.duration) || request.duration <= 0) throw new NativeExportCapacityError('Cannot estimate selected native streams');
  const rates = [positive(videos[0].bit_rate), positive(audio.bit_rate)];
  if (rates.some((n) => !Number.isFinite(n) || n <= 0) || !Number.isSafeInteger(sourceBytes) || sourceBytes <= 0) throw new NativeExportCapacityError('Cannot estimate native stream bitrate');
  const estimate = Math.ceil((rates[0] + rates[1]) * request.duration / 8 * 1.5 + 16 * 1024 ** 2);
  if (!Number.isSafeInteger(estimate) || estimate <= 0) throw new NativeExportCapacityError('Invalid native export estimate');
  return Math.min(estimate, sourceBytes + 16 * 1024 ** 2);
};

export const estimateRequestBytes = async (request: NativeClipExportRequest): Promise<{ bytes: number; sourceRevision: string }> => {
  const source = await lstat(request.sourcePath, { bigint: true });
  if (!source.isFile() || source.isSymbolicLink()) throw new NativeExportCapacityError('Invalid native export source');
  let raw: string | undefined;
  let probeError: unknown;
  try {
    raw = await runNativeExportProbe(getFfprobePath(), ['-v', 'error', '-show_streams', '-of', 'json', request.sourcePath], request.signal);
  } catch (error) { probeError = error; }
  if (request.signal?.aborted) throw probeError ?? new Error('Cancelled');
  const fingerprint = (item: typeof source): string => [item.dev, item.ino, item.size, item.mtimeNs, item.ctimeNs].join(':');
  let after: typeof source;
  try { after = await lstat(request.sourcePath, { bigint: true }); }
  catch { throw new NativeExportSourceChanged(); }
  if (fingerprint(source) !== fingerprint(after)) throw new NativeExportSourceChanged();
  if (probeError) throw probeError;
  let metadata: unknown;
  try { metadata = JSON.parse(raw ?? ''); } catch { throw new NativeExportCapacityError('Invalid native stream metadata'); }
  return { bytes: estimateNativeBytes(metadata, request, Number(source.size)), sourceRevision: fingerprint(source) };
};
