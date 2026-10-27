import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import {
  arrayValue,
  exactKeys,
  integerValue,
  objectValue,
  stringValue,
  enumValue,
} from '../../../src/shared/validation/jsonValues';
import {
  mediaConfigurationHash,
  parseCacheMediaMetadata,
  rational,
} from './cacheMediaMetadata';
import type { CacheMediaMetadata } from './cacheMediaMetadata';
import { isCacheExpectationValid } from './cachePolicy';
import type { CacheSourceIdentity, CacheTimingProof } from './cachePolicy';
import { CACHE_RECIPE } from './cacheRecipe';

export interface CacheContentData {
  metadata: CacheMediaMetadata;
  timing: CacheTimingProof;
}
export const CACHE_PROOF_BYTES = 256 * 1024;
export const CACHE_PROOF_VERSION = 'complete-content-v2';
export const cacheContentKey = (
  runtime: string,
  identity: CacheSourceIdentity,
): string =>
  createHash('sha256')
    .update(
      JSON.stringify([CACHE_PROOF_VERSION, CACHE_RECIPE, runtime, identity]),
    )
    .digest('hex');
const digest = (value: unknown): string => {
  const result = stringValue(value);
  if (!/^[a-f0-9]{64}$/.test(result)) throw Error('CACHE_PROOF_DIGEST');
  return result;
};
export const parseCacheContentData = (raw: unknown): CacheContentData => {
  const v = objectValue(raw);
  exactKeys(v, ['metadata', 'timing']);
  const m = objectValue(v.metadata);
  exactKeys(m, [
    'video',
    'audio',
    'interlaced',
    'displayScan',
    'displayScanEvidence',
    'timeScale',
    'outputFps',
    'durationSeconds',
  ]);
  const metadata = parseCacheMediaMetadata(
    { streams: [m.video, ...arrayValue(m.audio, 0, 8)] },
    enumValue(m.displayScan, ['progressive', 'top-first', 'bottom-first']),
  );
  // Round-trip rejects unknown stream fields and changed derived metadata.
  if (JSON.stringify(metadata) !== JSON.stringify(m))
    throw Error('CACHE_PROOF_METADATA');
  const t = objectValue(v.timing);
  exactKeys(t, [
    'fpsNumerator',
    'fpsDenominator',
    'displayFrames',
    'endNumerator',
    'endDenominator',
    'displayIntervalsSha256',
    'audio',
  ]);
  const timing: CacheTimingProof = {
    fpsNumerator: integerValue(t.fpsNumerator, 1),
    fpsDenominator: integerValue(t.fpsDenominator, 1),
    displayFrames: integerValue(t.displayFrames, 1, 28800),
    endNumerator: integerValue(t.endNumerator, 1),
    endDenominator: integerValue(t.endDenominator, 1),
    displayIntervalsSha256: digest(t.displayIntervalsSha256),
    audio: arrayValue(t.audio, 0, 8).map((rawTrack) => {
      const a = objectValue(rawTrack);
      exactKeys(a, [
        'streamIndex',
        'codec',
        'packets',
        'timesSha256',
        'payloadSha256',
        'configurationSha256',
      ]);
      return {
        streamIndex: integerValue(a.streamIndex, 1, 8),
        codec: stringValue(a.codec),
        packets: integerValue(a.packets, 1, 65536),
        timesSha256: digest(a.timesSha256),
        payloadSha256: digest(a.payloadSha256),
        configurationSha256: digest(a.configurationSha256),
      };
    }),
  };
  const base = rational(metadata.video.time_base);
  if (
    !isCacheExpectationValid({
      source: { sha256: '0'.repeat(64), bytes: 1 },
      recipe: CACHE_RECIPE,
      runtime: 'proof',
      timing,
    }) ||
    BigInt(timing.fpsNumerator) * BigInt(metadata.outputFps.denominator) !==
      BigInt(timing.fpsDenominator) * BigInt(metadata.outputFps.numerator) ||
    BigInt(timing.endNumerator) * BigInt(base.denominator) !==
      BigInt(metadata.video.start_pts + metadata.video.duration_ts) *
        BigInt(base.numerator) *
        BigInt(timing.endDenominator) ||
    timing.audio.length !== metadata.audio.length ||
    timing.audio.some(
      (a, i) =>
        a.streamIndex !== metadata.audio[i].index ||
        a.codec !== metadata.audio[i].codec_name ||
        a.configurationSha256 !== mediaConfigurationHash(metadata.audio[i]),
    )
  )
    throw Error('CACHE_PROOF_TIMING');
  return { metadata, timing };
};
export const encodeCacheProofLedger = (
  entries: Map<string, CacheContentData>,
  key: Buffer,
  scope: string,
): Buffer => {
  if (entries.size > 8) throw Error('CACHE_PROOF_COUNT');
  const payload = JSON.stringify({
    version: CACHE_PROOF_VERSION,
    scope,
    entries: [...entries].map(([id, data]) => [
      digest(id),
      parseCacheContentData(data),
    ]),
  });
  const bytes = Buffer.from(
    JSON.stringify({
      payload,
      mac: createHmac('sha256', key).update(payload).digest('hex'),
    }),
  );
  if (bytes.length > CACHE_PROOF_BYTES) throw Error('CACHE_PROOF_BUDGET');
  return bytes;
};
export const decodeCacheProofLedger = (
  bytes: Buffer,
  key: Buffer,
  scope: string,
): Map<string, CacheContentData> => {
  if (bytes.length > CACHE_PROOF_BYTES) throw Error('CACHE_PROOF_BUDGET');
  const envelope = objectValue(JSON.parse(bytes.toString('utf8')));
  exactKeys(envelope, ['payload', 'mac']);
  const payload = stringValue(envelope.payload),
    mac = Buffer.from(digest(envelope.mac), 'hex');
  if (!timingSafeEqual(mac, createHmac('sha256', key).update(payload).digest()))
    throw Error('CACHE_PROOF_AUTH');
  const data = objectValue(JSON.parse(payload));
  exactKeys(data, ['version', 'scope', 'entries']);
  if (data.version !== CACHE_PROOF_VERSION || data.scope !== scope)
    throw Error('CACHE_PROOF_VERSION');
  const entries = new Map<string, CacheContentData>();
  for (const value of arrayValue(data.entries, 0, 8)) {
    const pair = arrayValue(value, 2, 2),
      id = digest(pair[0]);
    if (entries.has(id)) throw Error('CACHE_PROOF_DUPLICATE');
    entries.set(id, parseCacheContentData(pair[1]));
  }
  return entries;
};
