import type { CacheIdentityReadObserver } from './sourceIdentity';
import { StringDecoder } from 'node:string_decoder';
import { runCacheConversion } from './cacheConversionRunner';
import { spawnCacheWorker } from './cacheWorkerProcess';
import { ProbeJsonSequence } from './probeJsonSequence';
import { parseCacheMediaMetadata } from './cacheMediaMetadata';
import type { CacheMediaMetadata } from './cacheMediaMetadata';
import type { CacheTimingProof } from './cachePolicy';
import { CacheTimingAccumulator } from './cacheTimingAccumulator';
import { CacheDisplayScanPrefix } from './cacheDisplayScan';

export interface CacheProbeContext {
  executable: string;
  signal: AbortSignal;
  stopWaiting: (unconfirmed: boolean) => void;
  observeIdentityRead?: CacheIdentityReadObserver;
}
const run = async (
  context: CacheProbeContext,
  args: string[],
  consume: (text: string) => void,
  threads: 2 | 4 = 2,
): Promise<void> => {
  const decoder = new StringDecoder('utf8');
  let failed = false;
  await runCacheConversion(
    (events) =>
      spawnCacheWorker(
        context.executable,
        [
          '-v',
          'error',
          '-threads',
          String(threads),
          '-protocol_whitelist',
          'file,pipe',
          '-format_whitelist',
          'mov',
          '-f',
          'mov',
          '-enable_drefs',
          '0',
          '-use_absolute_path',
          '0',
          ...args,
        ],
        {
          ...events,
          output: (stream, bytes) => {
            if (failed || context.signal.aborted) return;
            if (stream === 'diagnostic') {
              events.output(stream, bytes);
              if (bytes.length) {
                failed = true;
                events.error(Error('CACHE_PROBE_DECODE_ERROR'));
              }
              return;
            }
            try {
              consume(decoder.write(bytes));
            } catch (error) {
              failed = true;
              events.error(
                error instanceof Error ? error : Error('CACHE_PROBE_PARSE'),
              );
            }
          },
        },
      ),
    {
      signal: context.signal,
      durationSeconds: 120,
      timeoutMs: 600000,
      budgetPollMs: 1000,
      budgetDeadlineMs: 5000,
      stopWarningMs: 3000,
      maximumDiagnosticBytes: 1024 * 1024,
      checkBudget: async () => undefined,
      progress: () => undefined,
      stopWaiting: context.stopWaiting,
    },
  );
  consume(decoder.end());
};
export const probeCacheMetadata = async (
  source: string,
  context: CacheProbeContext,
): Promise<CacheMediaMetadata> => {
  let text = '';
  await run(
    context,
    ['-show_streams', '-show_data_hash', 'sha256', '-of', 'json', source],
    (part) => {
      text += part;
      if (Buffer.byteLength(text) > 1024 * 1024)
        throw Error('CACHE_PROBE_METADATA_LIMIT');
    },
  );
  const value: unknown = JSON.parse(text);
  try {
    return parseCacheMediaMetadata(value);
  } catch (error) {
    if (
      !(error instanceof Error) ||
      error.message !== 'CACHE_FIELD_ORDER_UNAVAILABLE'
    )
      throw error;
  }
  // Some MP4 headers omit field_order. Preserve that absence: classify display
  // order separately, then require the existing full timing pass before use.
  const prefix = new CacheDisplayScanPrefix();
  const frames = new ProbeJsonSequence('frames', (frame) =>
    prefix.frame(frame),
  );
  await run(
    context,
    [
      '-select_streams',
      'v:0',
      '-read_intervals',
      '%+#64',
      '-show_frames',
      '-show_entries',
      'frame=interlaced_frame,top_field_first,repeat_pict',
      '-of',
      'json',
      source,
    ],
    (part) => frames.write(part),
  );
  frames.finish();
  return parseCacheMediaMetadata(value, prefix.finish());
};
export const probeCacheTiming = async (
  source: string,
  metadata: CacheMediaMetadata,
  context: CacheProbeContext,
): Promise<CacheTimingProof> => {
  const proof = new CacheTimingAccumulator(metadata);
  const frames = new ProbeJsonSequence('frames', (value) => proof.frame(value));
  await run(
    context,
    [
      '-select_streams',
      'v:0',
      '-show_frames',
      '-show_entries',
      'frame=pts,duration,width,height,pix_fmt,interlaced_frame,top_field_first,repeat_pict',
      '-of',
      'json',
      source,
    ],
    (text) => frames.write(text),
    // Decode every frame with bounded parallelism; packet/metadata reads stay
    // at two threads and still run only after this worker has closed.
    4,
  );
  frames.finish();
  if (metadata.audio.length) {
    const packets = new ProbeJsonSequence('packets', (value) =>
      proof.packet(value),
    );
    await run(
      context,
      [
        '-select_streams',
        'a',
        '-show_packets',
        '-show_data_hash',
        'sha256',
        '-show_entries',
        'packet=stream_index,pts,dts,duration,size,data_hash:packet_side_data=side_data_type,skip_samples,discard_padding,skip_reason,discard_reason',
        '-of',
        'json',
        source,
      ],
      (text) => packets.write(text),
    );
    packets.finish();
  }
  return proof.finish();
};
