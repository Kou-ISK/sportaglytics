import { afterEach, expect, it, vi } from 'vitest';
import { readCaptureFragment } from './readCaptureFragment';
afterEach(() => vi.unstubAllGlobals());
it('reads the bounded fragment and safely encodes local source characters', async () => {
  const fetcher = vi.fn(async () => new Response(new Uint8Array([1, 2, 3])));
  vi.stubGlobal('fetch', fetcher);
  const signal = new AbortController().signal;
  expect(
    new Uint8Array(await readCaptureFragment('/media/Angle #1%.mp4', signal)),
  ).toEqual(new Uint8Array([1, 2, 3]));
  expect(fetcher).toHaveBeenCalledWith('file:///media/Angle%20%231%25.mp4', {
    signal,
  });
});
it('cancels an oversized file before reading its payload', async () => {
  const cancel = vi.fn();
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(new ReadableStream({ cancel }), {
          headers: { 'content-length': String(17 * 1024 * 1024) },
        }),
    ),
  );
  await expect(
    readCaptureFragment('/media/large.mp4', new AbortController().signal),
  ).rejects.toThrow('limit');
  expect(cancel).toHaveBeenCalledTimes(1);
});
