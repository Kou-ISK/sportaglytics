import { StringDecoder } from 'node:string_decoder';
import { getFfprobePath } from '../mediaTools';
import { runCacheConversion } from '../playbackCache/cacheConversionRunner';
import { spawnCacheWorker } from '../playbackCache/cacheWorkerProcess';

/** Header-only inspection. Completion, including timeout, waits for the owned
 * process to close. Never use frame/packet enumeration as an open prerequisite. */
export const probeNativeHeader = async (source: string): Promise<unknown> => {
  const decoder = new StringDecoder('utf8');
  let text = '',
    bytes = 0;
  await runCacheConversion(
    (events) =>
      spawnCacheWorker(
        getFfprobePath(),
        [
          '-v',
          'error',
          '-threads',
          '2',
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
          '-analyzeduration',
          '1000000',
          '-probesize',
          '1048576',
          '-show_entries',
          'stream=index,id,codec_type,codec_name,width,height,pix_fmt,sample_aspect_ratio,color_range,color_space,color_transfer,color_primaries,r_frame_rate,avg_frame_rate,time_base,start_pts,duration_ts,sample_rate,channels,channel_layout',
          '-of',
          'json',
          source,
        ],
        {
          ...events,
          output: (stream, chunk) => {
            if (stream === 'diagnostic') {
              if (chunk.length) events.error(Error('NATIVE_HEADER_ERROR'));
              return;
            }
            bytes += chunk.length;
            if (bytes > 1024 * 1024) {
              events.error(Error('NATIVE_HEADER_LIMIT'));
              return;
            }
            text += decoder.write(chunk);
          },
        },
      ),
    {
      signal: new AbortController().signal,
      durationSeconds: 1,
      timeoutMs: 5000,
      budgetPollMs: 1000,
      budgetDeadlineMs: 1000,
      stopWarningMs: 3000,
      maximumDiagnosticBytes: 65536,
      checkBudget: async () => undefined,
      progress: () => undefined,
      stopWaiting: () => undefined,
    },
  );
  return JSON.parse(text + decoder.end());
};
