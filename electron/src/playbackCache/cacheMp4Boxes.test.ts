import { expect, it, vi } from 'vitest';
import { CacheMp4BoxReader, readCacheMp4Box } from './cacheMp4Boxes';
import { cacheFragmentLayout } from './cacheFragmentLayout';
const box = (type: string, length = 8): Buffer => {
  const data = Buffer.alloc(length);
  data.writeUInt32BE(length);
  data.write(type, 4);
  return data;
};
const read = async (
  data: Buffer,
): Promise<Awaited<ReturnType<CacheMp4BoxReader['scan']>>> =>
  new CacheMp4BoxReader({
    read: async (at, length) => data.subarray(at, at + length),
  }).scan(0, data.length);
it('indexes fragments with bounded reads at each box start', async () => {
  const data = Buffer.concat([
    box('ftyp'),
    box('moov', 16),
    box('moof', 16),
    box('mdat', 40),
    box('moof', 16),
    box('mdat', 24),
    box('mfra'),
  ]);
  const port = vi.fn(async (at: number, length: number) =>
    data.subarray(at, at + length),
  );
  const boxes = await new CacheMp4BoxReader({ read: port }).scan(
    0,
    data.length,
  );
  expect(cacheFragmentLayout(boxes)).toEqual({
    kind: 'fragment-byte-layout',
    initialization: { start: 0, end: 24 },
    fragments: [
      { start: 24, end: 80 },
      { start: 80, end: 120 },
    ],
  });
  expect(port.mock.calls.every(([, n]) => n <= 16)).toBe(true);
  expect(port.mock.calls.map(([at]) => at)).toEqual([
    0, 8, 24, 40, 80, 96, 120,
  ]);
});
it('preserves64bit box bounds and closedMP4 size-zero semantics but rejects open-ended fragments', async () => {
  const h = Buffer.alloc(16);
  h.writeUInt32BE(1);
  h.write('mdat', 4);
  h.writeBigUInt64BE(5n * 1024n ** 3n, 8);
  expect(readCacheMp4Box(h, 24, 24 + 5 * 1024 ** 3).end).toBe(
    24 + 5 * 1024 ** 3,
  );
  const zero = box('mdat');
  zero.writeUInt32BE(0);
  expect(readCacheMp4Box(zero, 0, 80)).toMatchObject({
    end: 80,
    openEnded: true,
  });
  const boxes = await read(
    Buffer.concat([box('ftyp'), box('moov', 16), box('moof', 16), zero]),
  );
  expect(() => cacheFragmentLayout(boxes)).toThrow();
});
it.each([
  'short',
  'extended-short',
  'overflow',
  'small',
  'beyond',
  'unsafe-start',
  'fractional-end',
])('rejects malformed %s header', (kind) => {
  const h = Buffer.alloc(16);
  h.writeUInt32BE(16);
  h.write('mdat', 4);
  let start = 0,
    end = 24,
    header = h;
  if (kind === 'short') header = h.subarray(0, 7);
  if (kind === 'extended-short') {
    h.writeUInt32BE(1);
    header = h.subarray(0, 8);
  }
  if (kind === 'overflow') {
    h.writeUInt32BE(1);
    h.writeBigUInt64BE(2n ** 63n, 8);
  }
  if (kind === 'small') h.writeUInt32BE(7);
  if (kind === 'beyond') h.writeUInt32BE(25);
  if (kind === 'unsafe-start') start = Number.MAX_SAFE_INTEGER + 1;
  if (kind === 'fractional-end') end = 24.5;
  expect(() => readCacheMp4Box(header, start, end)).toThrow();
});
it.each([
  'missing-init',
  'double-init',
  'missing-data',
  'wrong-order',
  'truncated',
  'empty-data',
  'gap',
  'overlap',
  'large-init',
  'large-fragment',
])('rejects malformed %s fragment layout', async (kind) => {
  const boxes = await read(
    Buffer.concat([
      box('ftyp'),
      box('moov', 16),
      box('moof', 16),
      box('mdat', 16),
    ]),
  );
  if (kind === 'missing-init') boxes[1].type = 'free';
  if (kind === 'double-init') boxes[2].type = 'moov';
  if (kind === 'missing-data') boxes.pop();
  if (kind === 'wrong-order') boxes[2].type = 'mdat';
  if (kind === 'truncated') {
    boxes[3].end--;
    boxes[3].headerBytes = 16;
  }
  if (kind === 'empty-data') boxes[3].end = boxes[3].start + 8;
  if (kind === 'gap') boxes[3].start++;
  if (kind === 'overlap') boxes[3].start--;
  if (kind === 'large-init') {
    boxes[1].end = 2 * 1024 * 1024;
    boxes[2].start = boxes[1].end;
    boxes[2].end = boxes[2].start + 16;
    boxes[3].start = boxes[2].end;
    boxes[3].end = boxes[3].start + 16;
  }
  if (kind === 'large-fragment') boxes[3].end = 65 * 1024 * 1024;
  expect(() => cacheFragmentLayout(boxes)).toThrow();
});
it('shares header budget across nested scans and honors cancellation during read', async () => {
  const bytes = Buffer.concat([box('free'), box('free')]);
  const reader = new CacheMp4BoxReader(
    { read: async (at, n) => bytes.subarray(at, at + n) },
    2,
  );
  await reader.scan(0, bytes.length);
  await expect(reader.scan(0, 8)).rejects.toThrow();
  const cancel = new AbortController();
  let reads = 0;
  const aborted = new CacheMp4BoxReader({
    signal: cancel.signal,
    read: async () => {
      reads++;
      cancel.abort();
      return box('free');
    },
  });
  await expect(aborted.scan(0, 8)).rejects.toThrow();
  expect(reads).toBe(1);
});
it('rejects short reads and partial trailing headers', async () => {
  await expect(
    new CacheMp4BoxReader({ read: async () => Buffer.alloc(7) }).scan(0, 8),
  ).rejects.toThrow();
  await expect(
    read(Buffer.concat([box('free'), Buffer.alloc(4)])),
  ).rejects.toThrow();
});

it.each(['ftyp', 'moov', 'moof', 'mdat'])(
  'rejects a high-bit mutation of %s instead of aliasing its bytes',
  async (type) => {
    const chunks = ['ftyp', 'moov', 'moof', 'mdat'].map((name) =>
      box(name, 16),
    );
    const changed = chunks[['ftyp', 'moov', 'moof', 'mdat'].indexOf(type)];
    changed[4] |= 0x80;
    const parsed = await read(Buffer.concat(chunks));
    expect(parsed.map((entry) => entry.type)).not.toContain(type);
    expect(() => cacheFragmentLayout(parsed)).toThrow();
  },
);
