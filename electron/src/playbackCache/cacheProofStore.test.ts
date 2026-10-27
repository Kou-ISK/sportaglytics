import { createHmac } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, it as itOnAnyHost, vi } from 'vitest';
import { CacheProofStore } from './cacheProofStore';
import {
  cacheContentKey,
  encodeCacheProofLedger,
  decodeCacheProofLedger,
  parseCacheContentData,
  CACHE_PROOF_BYTES,
} from './cacheProofRecord';
import type { CacheContentData } from './cacheProofRecord';
import {
  openCacheProofDirectory,
  readCacheProofFile,
  writeCacheProofFile,
} from './cacheProofIo';
import {
  parseCacheMediaMetadata,
  mediaConfigurationHash,
} from './cacheMediaMetadata';
// Real POSIX descriptor/ownership contracts for the Mac-only cache path.
// Windows keeps the unsupported-platform and pure/IPC regressions.
const it = itOnAnyHost.skipIf(process.platform === 'win32');
let root: string, dir: string, store: CacheProofStore, abort: AbortController;
const data = (): CacheContentData => ({
  metadata: parseCacheMediaMetadata({
    streams: [
      {
        index: 0,
        codec_type: 'video',
        codec_name: 'h264',
        time_base: '1/24',
        start_pts: 0,
        duration_ts: 24,
        avg_frame_rate: '24/1',
        width: 320,
        height: 180,
        pix_fmt: 'yuv420p',
        field_order: 'progressive',
        disposition: {},
      },
    ],
  }),
  timing: {
    fpsNumerator: 24,
    fpsDenominator: 1,
    displayFrames: 24,
    endNumerator: 1,
    endDenominator: 1,
    displayIntervalsSha256: 'a'.repeat(64),
    audio: [],
  },
});
const id = (runtime = 'runtime') =>
  cacheContentKey(runtime, { sha256: 'b'.repeat(64), bytes: 8 });
beforeEach(async () => {
  root = await fs.realpath(
    await fs.mkdtemp(path.join(os.tmpdir(), 'proof-ledger-')),
  );
  dir = path.join(root, 'playback-content-proofs-v1');
  store = new CacheProofStore(
    () => root,
    async () => 'build-a',
  );
  abort = new AbortController();
});
afterEach(async () => {
  vi.restoreAllMocks();
  await fs.rm(root, { recursive: true, force: true });
});
it('retains complete proof across fresh instances only for the same byte/runtime/build binding', async () => {
  expect(await store.read(id(), abort.signal)).toBeNull();
  expect(await store.write(id(), data(), abort.signal)).toBe('stored');
  const restarted = new CacheProofStore(
    () => root,
    async () => 'build-a',
  );
  expect(await restarted.read(id(), abort.signal)).toEqual(data());
  expect(await restarted.read(id('other-runtime'), abort.signal)).toBeNull();
  expect(
    await new CacheProofStore(
      () => root,
      async () => 'build-b',
    ).read(id(), abort.signal),
  ).toBeNull();
});
it.each([
  'truncated',
  'payload',
  'mac',
  'version',
  'unknown',
  'timing',
  'metadata',
])(
  'rejects %s records including authenticated invalid shapes',
  async (change) => {
    await store.write(id(), data(), abort.signal);
    const file = path.join(dir, 'ledger.json'),
      envelope = JSON.parse(await fs.readFile(file, 'utf8'));
    if (change === 'truncated') {
      await fs.writeFile(file, '{');
    } else {
      const payload = JSON.parse(envelope.payload);
      if (change === 'payload') payload.scope = 'injected';
      if (change === 'mac') envelope.mac = '0'.repeat(64);
      if (change === 'version') payload.version = 'old';
      if (change === 'unknown') payload.extra = true;
      if (change === 'timing') payload.entries[0][1].timing.endNumerator = 2;
      if (change === 'metadata') payload.entries[0][1].metadata.extra = true;
      envelope.payload = JSON.stringify(payload);
      if (!['payload', 'mac'].includes(change))
        envelope.mac = createHmac(
          'sha256',
          await fs.readFile(path.join(dir, 'key')),
        )
          .update(envelope.payload)
          .digest('hex');
      await fs.writeFile(file, JSON.stringify(envelope));
    }
    expect(await store.read(id(), abort.signal)).toBeNull();
  },
);
it('never trusts incomplete temp or a prior ledger after key loss', async () => {
  await store.write(id(), data(), abort.signal);
  await fs.rename(
    path.join(dir, 'ledger.json'),
    path.join(dir, '.pending-00000000-0000-4000-8000-000000000000'),
  );
  expect(await store.read(id(), abort.signal)).toBeNull();
  await store.write(id(), data(), abort.signal);
  await fs.unlink(path.join(dir, 'key'));
  expect(await store.read(id(), abort.signal)).toBeNull();
});
it.each([
  'key-symlink',
  'ledger-hardlink',
  'key-mode',
  'root-symlink',
  'oversize',
  'key-truncated',
])(
  'disables unsafe storage %s without touching an external target',
  async (change) => {
    await store.write(id(), data(), abort.signal);
    const external = path.join(root, 'external');
    await fs.writeFile(external, 'untouched');
    if (change === 'key-symlink') {
      await fs.unlink(path.join(dir, 'key'));
      await fs.symlink(external, path.join(dir, 'key'));
    }
    if (change === 'ledger-hardlink')
      await fs.link(path.join(dir, 'ledger.json'), path.join(root, 'linked'));
    if (change === 'key-mode') await fs.chmod(path.join(dir, 'key'), 0o644);
    if (change === 'root-symlink') {
      await fs.rename(dir, dir + '-saved');
      await fs.symlink(dir + '-saved', dir);
    }
    if (change === 'oversize')
      await fs.writeFile(
        path.join(dir, 'ledger.json'),
        Buffer.alloc(CACHE_PROOF_BYTES + 1),
      );
    if (change === 'key-truncated')
      await fs.writeFile(path.join(dir, 'key'), 'short');
    expect(await store.read(id(), abort.signal)).toBeNull();
    expect(await store.write(id(), data(), abort.signal)).toBe('not-stored');
    expect(await fs.readFile(external, 'utf8')).toBe('untouched');
  },
);
it('serializes same-root writers and retains at most eight records', async () => {
  const other = new CacheProofStore(
    () => root,
    async () => 'build-a',
  );
  await Promise.all(
    Array.from({ length: 8 }, (_, i) =>
      (i % 2 ? other : store).write(id(String(i)), data(), abort.signal),
    ),
  );
  for (let i = 0; i < 8; i++)
    expect(await other.read(id(String(i)), abort.signal)).not.toBeNull();
  await store.write(id('8'), data(), abort.signal);
  expect(await other.read(id('0'), abort.signal)).toBeNull();
  expect(await other.read(id('8'), abort.signal)).not.toBeNull();
});
it('refuses a replaced directory under an already opened ownership stamp', async () => {
  const owned = await openCacheProofDirectory(root);
  await fs.rename(dir, dir + '-saved');
  await fs.mkdir(dir, { mode: 0o700 });
  await expect(
    readCacheProofFile(owned, 'key', 32, abort.signal),
  ).rejects.toThrow('CACHE_PROOF_DIRECTORY');
});
it('does not issue rename on cancellation before commit and keeps prior proof', async () => {
  await store.write(id(), data(), abort.signal);
  const original = fs.open.bind(fs);
  vi.spyOn(fs, 'open').mockImplementation(async (...args) => {
    const h = await original(...args);
    if (String(args[0]).includes('.pending-')) {
      const sync = h.sync.bind(h);
      vi.spyOn(h, 'sync').mockImplementation(async () => {
        await sync();
        abort.abort();
      });
    }
    return h;
  });
  const rename = vi.spyOn(fs, 'rename');
  await expect(store.write(id('new'), data(), abort.signal)).rejects.toThrow();
  expect(rename).not.toHaveBeenCalled();
  expect(await store.read(id(), new AbortController().signal)).not.toBeNull();
});
it('waits for dispatched rename and records committed data while rejecting the cancelled caller', async () => {
  await store.write(id(), data(), abort.signal);
  const rename = fs.rename.bind(fs),
    record = vi.fn();
  vi.spyOn(fs, 'rename').mockImplementation(async (...args) => {
    await rename(...args);
    abort.abort();
  });
  await expect(
    store.write(id('new'), data(), abort.signal, record),
  ).rejects.toThrow();
  expect(record.mock.calls.map((x) => x[0])).toEqual(['uncertain', 'stored']);
  expect(
    await store.read(id('new'), new AbortController().signal),
  ).not.toBeNull();
});
it('reports uncertain after post-rename directory fsync failure, without a second rename', async () => {
  await store.write(id(), data(), abort.signal);
  const original = fs.open.bind(fs);
  vi.spyOn(fs, 'open').mockImplementation(async (...args) => {
    const h = await original(...args);
    if (args[0] === dir)
      vi.spyOn(h, 'sync').mockRejectedValue(Error('sync failed'));
    return h;
  });
  const rename = vi.spyOn(fs, 'rename');
  expect(await store.write(id('new'), data(), abort.signal)).toBe('uncertain');
  expect(rename).toHaveBeenCalledTimes(1);
  expect(await store.read(id('new'), abort.signal)).not.toBeNull();
});
itOnAnyHost(
  'rejects invalid proof relationships and budget excess even with a valid MAC',
  () => {
    const key = Buffer.alloc(32, 1),
      value = data();
    const metadata = parseCacheMediaMetadata({
      streams: [
        value.metadata.video,
        {
          index: 1,
          codec_type: 'audio',
          codec_name: 'aac',
          time_base: '1/48000',
          start_pts: 0,
          duration_ts: 48000,
          avg_frame_rate: '0/0',
          sample_rate: '48000',
          channels: 2,
          channel_layout: 'stereo',
          extradata_hash: 'SHA256:' + 'a'.repeat(64),
          disposition: {},
        },
      ],
    });
    const audio = {
      ...value,
      metadata,
      timing: {
        ...value.timing,
        audio: [
          {
            streamIndex: 1,
            codec: 'aac',
            packets: 48,
            timesSha256: 'b'.repeat(64),
            payloadSha256: 'c'.repeat(64),
            configurationSha256: mediaConfigurationHash(metadata.audio[0]),
          },
        ],
      },
    };
    expect(parseCacheContentData(audio)).toEqual(audio);
    audio.timing.audio[0].packets = 65536;
    expect(parseCacheContentData(audio)).toEqual(audio);
    audio.timing.audio[0].packets = 65537;
    expect(() => parseCacheContentData(audio)).toThrow();
    audio.timing.audio[0].packets = 48;
    audio.timing.audio[0].configurationSha256 = 'd'.repeat(64);
    expect(() => parseCacheContentData(audio)).toThrow('CACHE_PROOF_TIMING');
    expect(() =>
      encodeCacheProofLedger(
        new Map(Array.from({ length: 9 }, (_, i) => [id(String(i)), data()])),
        key,
        'scope',
      ),
    ).toThrow();
    expect(() =>
      decodeCacheProofLedger(Buffer.alloc(CACHE_PROOF_BYTES + 1), key, 'scope'),
    ).toThrow();
  },
);
it('records no commit for a failed write and keeps no active handle', async () => {
  const owned = await openCacheProofDirectory(root),
    original = fs.open.bind(fs);
  vi.spyOn(fs, 'open').mockImplementation(async (...args) => {
    const h = await original(...args);
    if (String(args[0]).includes('.pending-'))
      vi.spyOn(h, 'writeFile').mockRejectedValue(Error('disk full'));
    return h;
  });
  await expect(
    writeCacheProofFile(owned, Buffer.from('small'), abort.signal),
  ).rejects.toThrow('disk full');
  expect(await fs.readdir(dir)).toEqual([]);
});
it('stops directory traversal after a pending read is cancelled and still closes the directory', async () => {
  await openCacheProofDirectory(root);
  const original = fs.opendir.bind(fs);
  let release: () => void = () => undefined,
    started: () => void = () => undefined;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  const ready = new Promise<void>((resolve) => {
    started = resolve;
  });
  const closed = vi.fn();
  vi.spyOn(fs, 'opendir').mockImplementation(async (...args) => {
    const directory = await original(...args),
      read = directory.read.bind(directory),
      close = directory.close.bind(directory);
    vi.spyOn(directory, 'read').mockImplementation(async () => {
      started();
      await pending;
      return read();
    });
    vi.spyOn(directory, 'close').mockImplementation(async () => {
      closed();
      await close();
    });
    return directory;
  });
  const stat = vi.spyOn(fs, 'lstat'),
    mkdir = vi.spyOn(fs, 'mkdir');
  const work = openCacheProofDirectory(root, abort.signal);
  await ready;
  const count = stat.mock.calls.length,
    creates = mkdir.mock.calls.length;
  abort.abort();
  release();
  await expect(work).rejects.toThrow();
  expect(stat).toHaveBeenCalledTimes(count);
  expect(mkdir).toHaveBeenCalledTimes(creates);
  expect(closed).toHaveBeenCalledTimes(1);
});
it('bounds directory enumeration to eleven entries before rejecting overflow', async () => {
  await openCacheProofDirectory(root);
  for (let i = 0; i < 12; i++)
    await fs.writeFile(
      path.join(
        dir,
        `.pending-${String(i).padStart(8, '0')}-0000-4000-8000-000000000000`,
      ),
      '',
      { mode: 0o600 },
    );
  const original = fs.opendir.bind(fs),
    readCount = vi.fn();
  vi.spyOn(fs, 'opendir').mockImplementation(async (...args) => {
    const directory = await original(...args),
      read = directory.read.bind(directory);
    vi.spyOn(directory, 'read').mockImplementation(async () => {
      readCount();
      return read();
    });
    return directory;
  });
  await expect(openCacheProofDirectory(root, abort.signal)).rejects.toThrow(
    'CACHE_PROOF_ENTRIES',
  );
  expect(readCount).toHaveBeenCalledTimes(11);
});
itOnAnyHost('compares equivalent field-rate rationals', () => {
  const value = data();
  value.metadata = parseCacheMediaMetadata({
    streams: [
      {
        ...value.metadata.video,
        time_base: '1/25',
        duration_ts: 50,
        avg_frame_rate: '25/2',
        field_order: 'tt',
      },
    ],
  });
  value.timing = {
    ...value.timing,
    fpsNumerator: 25,
    fpsDenominator: 1,
    displayFrames: 50,
    endNumerator: 2,
  };
  expect(parseCacheContentData(value)).toEqual(value);
  value.timing.fpsNumerator = 26;
  expect(() => parseCacheContentData(value)).toThrow('CACHE_PROOF_TIMING');
});
