import { StringDecoder } from 'node:string_decoder';
import { exactKeys, objectValue } from '../../../../src/shared/validation/jsonValues';
import { runCacheConversion } from '../../playbackCache/cacheConversionRunner';
import { spawnCacheWorker } from '../../playbackCache/cacheWorkerProcess';

/** Protocol scope only. It grants no source access or performance guarantee. */
export interface NativeGroupCapability {
  readonly version: 1;
  readonly transport: 2;
  readonly mode: 'placed-pair-decoded-samples';
  readonly angles: 2;
  readonly clipsPerAngle: 1;
  readonly timescale: 120000;
  readonly imageBudgetBytes: 536870912;
  readonly stopAuthority: 'submitted-pair-v1';
}

export const parseNativeGroupCapability = (raw: unknown): NativeGroupCapability => {
  const value = objectValue(raw);
  exactKeys(value, ['version', 'transport', 'mode', 'angles', 'clipsPerAngle',
    'timescale', 'imageBudgetBytes', 'stopAuthority']);
  if (value.version !== 1 || value.transport !== 2 ||
      value.mode !== 'placed-pair-decoded-samples' || value.angles !== 2 ||
      value.clipsPerAngle !== 1 || value.timescale !== 120000 ||
      value.imageBudgetBytes !== 536870912 || value.stopAuthority !== 'submitted-pair-v1')
    throw Error('NATIVE_GROUP_CAPABILITY_UNSUPPORTED');
  return Object.freeze({ version: 1, transport: 2, mode: 'placed-pair-decoded-samples',
    angles: 2, clipsPerAngle: 1, timescale: 120000, imageBudgetBytes: 536870912,
    stopAuthority: 'submitted-pair-v1' });
};

/** Main calls only after resource-set/signature/hash validation. A revision or
 * addon method does not authorize this protocol. Each caller owns its signal;
 * there is no shared probe whose cancellation can stop a different caller.
 * Timeout/abort request termination but completion still waits for child close.
 * An unresponsive child cannot be reported as drained by this deadline. */
export const probeNativeGroupCapability = async (
  verifiedHost: string,
  signal: AbortSignal,
): Promise<NativeGroupCapability> => {
  const decoder = new StringDecoder('utf8');
  let text = '', bytes = 0;
  await runCacheConversion((events) => spawnCacheWorker(verifiedHost,
    ['--group-playback-capabilities'], {
      ...events,
      output: (stream, chunk) => {
        bytes += chunk.length;
        if (bytes > 4096) {
          events.error(Error('NATIVE_GROUP_CAPABILITY_LIMIT'));
          return;
        }
        if (stream !== 'progress') {
          if (chunk.length) events.error(Error('NATIVE_GROUP_CAPABILITY_DIAGNOSTIC'));
          return;
        }
        text += decoder.write(chunk);
      },
    }), {
    signal, durationSeconds: 1, timeoutMs: 2000, budgetPollMs: 1000,
    budgetDeadlineMs: 1000, stopWarningMs: 1000, maximumDiagnosticBytes: 4096,
    checkBudget: async () => undefined, progress: () => undefined,
    stopWaiting: () => undefined,
  });
  return parseNativeGroupCapability(JSON.parse(text + decoder.end()));
};
