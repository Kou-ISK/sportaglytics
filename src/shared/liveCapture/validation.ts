import type {
  CaptureChunk,
  CaptureInput,
  CaptureStartRequest,
} from '../../types/liveCapture';

export const CAPTURE_MAX_CHUNK_BYTES = 1024 * 1024;
export const CAPTURE_MAX_QUEUED_BYTES = 8 * 1024 * 1024;
export const CAPTURE_MAX_INPUTS = 4;
export const CAPTURE_SEGMENT_SECONDS = 2;

export const isCaptureIdentifier = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(value);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const isCaptureUrl = (value: unknown): value is string => {
  if (
    typeof value !== 'string' ||
    value.length > 2048 ||
    /[\s\x00-\x1f]/.test(value)
  )
    return false;
  try {
    const url = new URL(value);
    return (
      ['rtsp:', 'rtsps:', 'rtmp:', 'rtmps:', 'http:', 'https:'].includes(
        url.protocol,
      ) &&
      Boolean(url.hostname) &&
      !url.hash
    );
  } catch {
    return false;
  }
};

const isInput = (value: unknown): value is CaptureInput =>
  isRecord(value) &&
  isCaptureIdentifier(value.id) &&
  typeof value.name === 'string' &&
  value.name.trim().length > 0 &&
  value.name.length <= 80 &&
  (value.kind === 'device' ||
    (value.kind === 'network' && isCaptureUrl(value.url)));

export const isCaptureStartRequest = (
  value: unknown,
): value is CaptureStartRequest => {
  if (
    !isRecord(value) ||
    typeof value.name !== 'string' ||
    !value.name.trim() ||
    value.name.length > 100 ||
    /[\\/:*?"<>|\x00-\x1f]/.test(value.name) ||
    !Array.isArray(value.inputs) ||
    !value.inputs.every(isInput) ||
    value.inputs.length < 1 ||
    value.inputs.length > CAPTURE_MAX_INPUTS ||
    !['1080p', '720p'].includes(String(value.quality))
  )
    return false;
  return (
    new Set(value.inputs.map((input) => input.id)).size === value.inputs.length
  );
};

export const isCaptureChunk = (value: unknown): value is CaptureChunk =>
  isRecord(value) &&
  isCaptureIdentifier(value.sessionId) &&
  isCaptureIdentifier(value.inputId) &&
  typeof value.sequence === 'number' &&
  Number.isSafeInteger(value.sequence) &&
  value.sequence >= 0 &&
  value.data instanceof Uint8Array &&
  value.data.byteLength > 0 &&
  value.data.byteLength <= CAPTURE_MAX_CHUNK_BYTES;
