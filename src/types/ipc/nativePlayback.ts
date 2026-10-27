import { parseNativePlaybackPresentation } from './nativePlaybackPresentation';
import type { NativePlaybackPresentation } from './nativePlaybackPresentation';
import {
  objectValue,
  stringValue,
  integerValue,
  numberValue,
  booleanValue,
  enumValue,
  exactKeys,
} from '../../shared/validation/jsonValues';

/** Ephemeral playback authority; never serialized into package metadata. */
export interface NativePlaybackOwner {
  generation: string;
  sourceKey: string;
}
export interface NativePlaybackIntent extends NativePlaybackOwner {
  sequence: number;
  seekId: number;
  targetTime: number;
  /** Omission is exact. Preview is held; scrub commits its measured image time. */
  seekMode?: 'preview' | 'scrub';
  playing: boolean;
  rate: number;
  audioTrack: number;
  volume: number;
  muted: boolean;
}
export interface NativePlaybackObservation extends NativePlaybackOwner {
  revision: number;
  sequence: number;
  seekId: number;
  phase:
    | 'preparing'
    | 'paused'
    | 'playing'
    | 'seeking'
    | 'buffering'
    | 'starved'
    | 'failed'
    | 'closing'
    | 'closed';
  time: number;
  rate: number;
  audioTrack: number;
  volume: number;
  muted: boolean;
  videoReady: boolean;
  audioReady: boolean;
  error: 'media' | 'protocol' | 'timeout' | 'owner' | 'cleanup' | null;
}
export interface NativePlaybackAvailability {
  /** Current package endpoint; distinct from the qualified video field end. */
  sourceEnd: number | null;
  presentation: NativePlaybackPresentation | null;
  available: boolean;
  owner: NativePlaybackOwner | null;
  sourceUrl: string | null;
  reason: 'disabled' | 'unsupported' | 'busy' | null;
}
export interface NativePlaybackClosed {
  generation: string;
  nativeDrained: boolean;
  processStarted: boolean;
  processExited: boolean;
  pipesClosed: boolean;
  /** Measured stopped source clock, retained before renderer disposal. */
  stopped: NativePlaybackStopped | null;
}
export interface NativePlaybackStopped extends NativePlaybackOwner {
  sequence: number;
  seekId: number;
  time: number;
  rate: 0;
}

export interface NativePlaybackSnapshot {
  intent: NativePlaybackIntent | null;
  observation: NativePlaybackObservation | null;
  lastConfirmedTime: number;
  error: NativePlaybackObservation['error'];
  closing: boolean;
  closed: boolean;
}
export const parseNativePlaybackSnapshot = (
  raw: unknown,
): NativePlaybackSnapshot => {
  const v = objectValue(raw);
  exactKeys(v, [
    'intent',
    'observation',
    'lastConfirmedTime',
    'error',
    'closing',
    'closed',
  ]);
  return {
    intent: v.intent === null ? null : parseNativePlaybackIntent(v.intent),
    observation:
      v.observation === null
        ? null
        : parseNativePlaybackObservation(v.observation),
    lastConfirmedTime: numberValue(v.lastConfirmedTime, 0, 86400),
    error:
      v.error === null
        ? null
        : enumValue(v.error, [
            'media',
            'protocol',
            'timeout',
            'owner',
            'cleanup',
          ]),
    closing: booleanValue(v.closing),
    closed: booleanValue(v.closed),
  };
};

const ownerKeys = ['generation', 'sourceKey'];
const ownerValue = (v: Record<string, unknown>): NativePlaybackOwner => {
  const generation = stringValue(v.generation, 1, 128);
  const sourceKey = stringValue(v.sourceKey, 64, 64);
  if (!/^[\w-]+$/.test(generation) || !/^[a-f0-9]{64}$/.test(sourceKey))
    throw Error('NATIVE_INVALID_OWNER');
  return { generation, sourceKey };
};
export const parseNativePlaybackOwner = (raw: unknown): NativePlaybackOwner => {
  const v = objectValue(raw);
  exactKeys(v, ownerKeys);
  return ownerValue(v);
};
export const parseNativePlaybackIntent = (
  raw: unknown,
): NativePlaybackIntent => {
  const v = objectValue(raw);
  exactKeys(v, [
    ...ownerKeys,
    'sequence',
    'seekId',
    'targetTime',
    'seekMode',
    'playing',
    'rate',
    'audioTrack',
    'volume',
    'muted',
  ]);
  return {
    ...ownerValue(v),
    sequence: integerValue(v.sequence, 1),
    seekId: integerValue(v.seekId, 1),
    targetTime: numberValue(v.targetTime, 0, 86400),
    ...(v.seekMode === undefined
      ? {}
      : { seekMode: enumValue(v.seekMode, ['preview', 'scrub']) }),
    playing: booleanValue(v.playing),
    rate: numberValue(v.rate, 0.25, 6),
    audioTrack: integerValue(v.audioTrack, 0, 7),
    volume: numberValue(v.volume, 0, 1),
    muted: booleanValue(v.muted),
  };
};
export const parseNativePlaybackObservation = (
  raw: unknown,
): NativePlaybackObservation => {
  const v = objectValue(raw);
  exactKeys(v, [
    ...ownerKeys,
    'revision',
    'sequence',
    'seekId',
    'phase',
    'time',
    'rate',
    'audioTrack',
    'volume',
    'muted',
    'videoReady',
    'audioReady',
    'error',
  ]);
  const phase = enumValue(v.phase, [
    'preparing',
    'paused',
    'playing',
    'seeking',
    'buffering',
    'starved',
    'failed',
    'closing',
    'closed',
  ]);
  const rate = numberValue(v.rate, 0, 6);
  const videoReady = booleanValue(v.videoReady),
    audioReady = booleanValue(v.audioReady);
  if (
    (phase === 'playing' && (!videoReady || !audioReady || rate === 0)) ||
    (phase !== 'playing' && rate !== 0) ||
    (phase === 'buffering' && (videoReady || audioReady || v.error !== null))
  )
    throw Error('NATIVE_INVALID_CLOCK_STATE');
  return {
    ...ownerValue(v),
    revision: integerValue(v.revision, 1),
    sequence: integerValue(v.sequence, 0),
    seekId: integerValue(v.seekId, 0),
    phase,
    time: numberValue(v.time, 0, 86400),
    rate,
    audioTrack: integerValue(v.audioTrack, 0, 7),
    volume: numberValue(v.volume, 0, 1),
    muted: booleanValue(v.muted),
    videoReady,
    audioReady,
    error:
      v.error === null
        ? null
        : enumValue(v.error, [
            'media',
            'protocol',
            'timeout',
            'owner',
            'cleanup',
          ]),
  };
};
export const parseNativePlaybackClosed = (
  raw: unknown,
): NativePlaybackClosed => {
  const v = objectValue(raw);
  exactKeys(v, [
    'generation',
    'nativeDrained',
    'processStarted',
    'processExited',
    'pipesClosed',
    'stopped',
  ]);
  let stopped: NativePlaybackStopped | null = null;
  if (v.stopped !== null) {
    const s = objectValue(v.stopped);
    exactKeys(s, [
      'generation',
      'sourceKey',
      'sequence',
      'seekId',
      'time',
      'rate',
    ]);
    if (s.rate !== 0) throw Error('NATIVE_STOP_CLOCK_RUNNING');
    stopped = {
      ...parseNativePlaybackOwner({
        generation: s.generation,
        sourceKey: s.sourceKey,
      }),
      sequence: integerValue(s.sequence, 1, Number.MAX_SAFE_INTEGER),
      seekId: integerValue(s.seekId, 1, Number.MAX_SAFE_INTEGER),
      time: numberValue(s.time, 0, 86400),
      rate: 0,
    };
    if (
      stopped.seekId > stopped.sequence ||
      stopped.generation !== v.generation
    )
      throw Error('NATIVE_STOP_OWNER_CHANGED');
  }
  return {
    generation: stringValue(v.generation, 1, 128),
    nativeDrained: booleanValue(v.nativeDrained),
    processStarted: booleanValue(v.processStarted),
    processExited: booleanValue(v.processExited),
    pipesClosed: booleanValue(v.pipesClosed),
    stopped,
  };
};
export const parseNativePlaybackAvailability = (
  raw: unknown,
): NativePlaybackAvailability => {
  const v = objectValue(raw);
  exactKeys(v, [
    'available',
    'owner',
    'sourceUrl',
    'sourceEnd',
    'reason',
    'presentation',
  ]);
  const presentation =
    v.presentation === null
      ? null
      : parseNativePlaybackPresentation(v.presentation);
  const sourceEnd =
    v.sourceEnd === null
      ? null
      : numberValue(v.sourceEnd, Number.MIN_VALUE, 86400);
  const available = booleanValue(v.available);
  const owner = v.owner === null ? null : parseNativePlaybackOwner(v.owner);
  const sourceUrl =
    v.sourceUrl === null ? null : stringValue(v.sourceUrl, 1, 8192);
  if (
    (sourceUrl && new URL(sourceUrl).protocol !== 'file:') ||
    (available && (!owner || !sourceUrl))
  )
    throw Error('NATIVE_INVALID_AVAILABILITY');
  const reason =
    v.reason === null
      ? null
      : enumValue(v.reason, ['disabled', 'unsupported', 'busy']);
  if (
    available
      ? reason !== null
      : owner !== null ||
        sourceUrl !== null ||
        reason === null ||
        presentation !== null ||
        sourceEnd !== null
  )
    throw Error('NATIVE_INVALID_AVAILABILITY');
  return { available, owner, sourceUrl, sourceEnd, reason, presentation };
};
export const nativePlaybackChannels = {
  inspect: 'native-playback:inspect',
  open: 'native-playback:open',
  apply: 'native-playback:apply',
  observe: 'native-playback:observe',
  close: 'native-playback:close',
  reportFailure: 'native-playback:report-failure',
} as const;

/** Main-to-preload only; not an invoke/event-bus endpoint. */
export const nativePlaybackSnapshotChannel = 'native-playback:snapshot';

export const nativePlaybackSnapshotAckChannel = 'native-playback:snapshot-ack';
export const parseNativeSnapshotAcknowledgement = (
  raw: unknown,
): { owner: NativePlaybackOwner; delivery: number } => {
  const value = objectValue(raw);
  exactKeys(value, ['owner', 'delivery']);
  return {
    owner: parseNativePlaybackOwner(value.owner),
    delivery: integerValue(value.delivery, 1, Number.MAX_SAFE_INTEGER),
  };
};
