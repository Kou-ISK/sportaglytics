import { formatSource } from '../../../../shared/media/videoSource';

const MAX_FRAGMENT_BYTES = 16 * 1024 * 1024;

/** Keep malformed or externally replaced package files from allocating an unbounded buffer. */
export const readCaptureFragment = async (
  path: string,
  signal: AbortSignal,
): Promise<ArrayBuffer> => {
  const response = await fetch(formatSource(path), { signal });
  if (!response.ok || !response.body)
    throw new Error('Recorded fragment unavailable');
  const reader = response.body.getReader();
  const parts: Uint8Array[] = [];
  let size = 0;
  try {
    if (Number(response.headers.get('content-length')) > MAX_FRAGMENT_BYTES)
      throw new Error('Recorded fragment exceeds buffer limit');
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_FRAGMENT_BYTES)
        throw new Error('Recorded fragment exceeds buffer limit');
      parts.push(value);
    }
    const result = new Uint8Array(size);
    let offset = 0;
    for (const part of parts) {
      result.set(part, offset);
      offset += part.length;
    }
    return result.buffer;
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
};
