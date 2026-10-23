import {
  objectValue,
  stringValue,
  integerValue,
  numberValue,
  booleanValue,
  enumValue,
  exactKeys,
} from '../../shared/validation/jsonValues';
import type { PlaybackCacheStatus } from '../playbackCache';

export interface PlaybackCacheRequest {
  generation: string;
  sourceKey: string;
}
export interface PlaybackCacheSelection extends PlaybackCacheRequest {
  ticket: string | null;
}
export interface PlaybackCacheCandidate {
  url: string;
  ticket: string;
  audioTracks: number;
}
export interface PlaybackCacheSnapshot {
  generation: string;
  source: {
    key: string;
    url: string;
    label: string;
    audioTracks: number | null;
  } | null;
  status: PlaybackCacheStatus;
  available: boolean;
  maximumCacheBytes: number;
  reserveBytes: number;
}
const uuid = (value: unknown): string => {
  const result = stringValue(value);
  if (
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
      result,
    )
  )
    throw Error('CACHE_INVALID_UUID');
  return result;
};
const sourceKey = (value: unknown): string => {
  const result = stringValue(value);
  if (!/^[a-f0-9]{64}$/.test(result)) throw Error('CACHE_INVALID_SOURCE_KEY');
  return result;
};
const fileUrl = (value: unknown): string => {
  const result = stringValue(value);
  if (new URL(result).protocol !== 'file:') throw Error('CACHE_INVALID_URL');
  return result;
};
export const parsePlaybackCacheRequest = (
  value: unknown,
): PlaybackCacheRequest => {
  const v = objectValue(value);
  exactKeys(v, ['generation', 'sourceKey']);
  return { generation: uuid(v.generation), sourceKey: sourceKey(v.sourceKey) };
};
export const parsePlaybackCacheSelection = (
  value: unknown,
): PlaybackCacheSelection => {
  const v = objectValue(value);
  exactKeys(v, ['generation', 'sourceKey', 'ticket']);
  return {
    generation: uuid(v.generation),
    sourceKey: sourceKey(v.sourceKey),
    ticket: v.ticket === null ? null : uuid(v.ticket),
  };
};
export const parsePlaybackCacheCandidate = (
  value: unknown,
): PlaybackCacheCandidate => {
  const v = objectValue(value);
  return {
    url: fileUrl(v.url),
    ticket: uuid(v.ticket),
    audioTracks: integerValue(v.audioTracks, 0, 8),
  };
};
export const parsePlaybackCacheSnapshot = (
  value: unknown,
): PlaybackCacheSnapshot => {
  const v = objectValue(value);
  const s = objectValue(v.status);
  const source = v.source === null ? null : objectValue(v.source);
  return {
    generation: uuid(v.generation),
    source:
      source === null
        ? null
        : {
            key: sourceKey(source.key),
            url: fileUrl(source.url),
            label: stringValue(source.label),
            audioTracks:
              source.audioTracks === null
                ? null
                : integerValue(source.audioTracks, 0, 8),
          },
    status: {
      phase: enumValue(s.phase, [
        'original',
        'converting',
        'validating',
        'publishing',
        'cancelling',
        'ready',
        'failed',
      ]),
      selected: enumValue(s.selected, ['original', 'cache']),
      progress: s.progress === null ? null : numberValue(s.progress, 0, 1),
      error:
        s.error === null
          ? null
          : enumValue(s.error, [
              'capacity',
              'validation',
              'operation',
              'cleanup',
              'stop',
            ]),
    },
    available: booleanValue(v.available),
    maximumCacheBytes: integerValue(v.maximumCacheBytes, 1),
    reserveBytes: integerValue(v.reserveBytes, 1),
  };
};
export const playbackCacheChannels = {
  inspect: 'playback-cache:inspect',
  prepare: 'playback-cache:prepare',
  cancel: 'playback-cache:cancel',
  cleanup: 'playback-cache:cleanup',
  candidate: 'playback-cache:candidate',
  selected: 'playback-cache:selected',
} as const;
