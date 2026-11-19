import {
  numberValue,
  objectValue,
  stringValue,
} from '../../shared/validation/jsonValues';

export const scrubPreviewChannels = {
  prepare: 'scrub-preview:prepare',
  validate: 'scrub-preview:validate',
  release: 'scrub-preview:release',
} as const;
export const scrubTicksPerSecond = 60000;
export const scrubByteLimit = 12 * 1024 * 1024;
export interface ScrubPreviewRequest {
  token: string;
  time: number;
}
export interface ScrubPreviewStrip {
  sourceUrl: string;
  bytes: Uint8Array;
  frames: { pts: number; offset: number; size: number }[];
}
export const scrubToken = (value: unknown): string => {
  const token = stringValue(value, 36, 36);
  if (!/^[0-9a-f-]{36}$/.test(token)) throw Error('INVALID_SCRUB_TOKEN');
  return token;
};
export const scrubRequest = (value: unknown): ScrubPreviewRequest => {
  const data = objectValue(value);
  return {
    token: scrubToken(data.token),
    time: numberValue(data.time, 0, 86400),
  };
};
