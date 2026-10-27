import type { Dirent } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { preparePackageForOpen } from './legacyPackageMigrationService';
import { packageCopyDigest } from './packageCopyDigest';
import { prepareLegacyPackageCopy } from './legacyPackageCopyService';
import { collectPreviousPackageCopies } from './packageMigrationCandidates';
import * as sourceSnapshot from './packageSourceSnapshot';

const roots: string[] = [];
const fixture = async (legacy: boolean): Promise<string> => {
  const root = await fs.realpath(
    await fs.mkdtemp(path.join(os.tmpdir(), 'candidate-cancel-')),
  );
  roots.push(root);
  const source = path.join(root, 'Sample.stpkg');
  await fs.mkdir(path.join(source, '.metadata'), { recursive: true });
  await fs.writeFile(path.join(source, 'video.mp4'), Buffer.from([0, 1, 2, 3]));
  await fs.writeFile(
    path.join(source, '.metadata/config.json'),
    JSON.stringify(
      legacy
        ? { tightViewPath: 'video.mp4' }
        : {
            schemaVersion: 1,
            angles: [
              {
                id: 'camera',
                name: 'Camera',
                clips: [
                  {
                    id: 'clip',
                    relativePath: 'video.mp4',
                    gapBeforeSeconds: 0,
                  },
                ],
              },
            ],
          },
    ),
  );
  await fs.writeFile(
    path.join(source, 'timeline.json'),
    JSON.stringify({ version: 2, instances: [], rows: [] }),
  );
  return source;
};
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(
    roots
      .splice(0)
      .map((root) => fs.rm(root, { recursive: true, force: true })),
  );
});

it.each([false, true])(
  'cancels migration-candidate enumeration before binding or choosing; legacy=%s',
  async (legacy) => {
    const source = await fixture(legacy);
    const parent = path.dirname(source);
    const before = await packageCopyDigest(source);
    const actualEntries = await fs.readdir(parent, { withFileTypes: true });
    let release: (value: Dirent[]) => void = () => undefined;
    const held = new Promise<Dirent[]>((resolve) => {
      release = resolve;
    });
    const read = fs.readdir.bind(fs);
    let started = false;
    const reading = vi.spyOn(fs, 'readdir').mockImplementation((...args) => {
      if (String(args[0]) === parent && args.length === 2) {
        started = true;
        return held;
      }
      return Reflect.apply(read, fs, args);
    });
    const controller = new AbortController();
    const waiting = vi.fn();
    const choose = vi.fn(async () => null);
    let outcome: unknown;
    const pending = preparePackageForOpen(source, {
      choose,
      historyRead: { signal: controller.signal, directoryWaiting: waiting },
    }).then(
      (value) => {
        outcome = value;
      },
      (error: unknown) => {
        outcome = error;
      },
    );
    try {
      await vi.waitFor(() => expect(started).toBe(true));
      expect(waiting).toHaveBeenLastCalledWith(true);
      controller.abort();
      await vi.waitFor(() =>
        expect(outcome).toEqual(new Error('PACKAGE_OPEN_CANCELLED')),
      );
      expect(choose).not.toHaveBeenCalled();
    } finally {
      controller.abort();
      reading.mockRestore();
      release(actualEntries);
      await pending;
    }
    expect(choose).not.toHaveBeenCalled();
    expect(await packageCopyDigest(source)).toBe(before);
    expect(await fs.readdir(parent)).toEqual(['Sample.stpkg']);
    if (legacy)
      await expect(preparePackageForOpen(source, { choose })).rejects.toThrow(
        'PACKAGE_MIGRATION_CANCELLED',
      );
    else
      expect(await preparePackageForOpen(source)).toMatchObject({
        status: 'ready',
        migrated: false,
        packagePath: source,
      });
  },
);

it('does not start an update if the owner leaves while the content choice is open', async () => {
  const source = await fixture(true);
  const before = await packageCopyDigest(source);
  const controller = new AbortController();
  const choose = vi.fn(async () => {
    controller.abort();
    return source;
  });
  await expect(
    preparePackageForOpen(source, {
      choose,
      historyRead: { signal: controller.signal },
    }),
  ).rejects.toThrow('PACKAGE_OPEN_CANCELLED');
  expect(choose).toHaveBeenCalledOnce();
  expect(await packageCopyDigest(source)).toBe(before);
  expect(await fs.readdir(path.dirname(source))).toEqual(['Sample.stpkg']);
});

it('discovers a new migration copy on retry after a cancelled stale enumeration fails', async () => {
  const source = await fixture(true);
  const parent = path.dirname(source);
  let rejectRead: (reason: Error) => void = () => undefined;
  const delayed = new Promise<Dirent[]>((_resolve, reject) => {
    rejectRead = reject;
  });
  const read = fs.readdir.bind(fs);
  let intercepted = false;
  const reading = vi.spyOn(fs, 'readdir').mockImplementation((...args) => {
    if (String(args[0]) === parent && args.length === 2 && !intercepted) {
      intercepted = true;
      return delayed;
    }
    return Reflect.apply(read, fs, args);
  });
  const controller = new AbortController();
  const first = collectPreviousPackageCopies(source, undefined, {
    signal: controller.signal,
  });
  const cancelled = expect(first).rejects.toThrow('PACKAGE_OPEN_CANCELLED');
  await vi.waitFor(() => expect(intercepted).toBe(true));
  controller.abort();
  await cancelled;
  reading.mockRestore();
  try {
    const target = path.join(parent, 'New copy.stpkg');
    await prepareLegacyPackageCopy(source, target);
    const retry = collectPreviousPackageCopies(source);
    rejectRead(new Error('late EIO'));
    expect(await retry).toEqual(new Set([target]));
  } finally {
    rejectRead(new Error('late EIO'));
  }
});

it('does not show a conflict choice after cancellation during its source snapshots', async () => {
  const source = await fixture(true);
  const target = path.join(path.dirname(source), 'Edited.stpkg');
  await prepareLegacyPackageCopy(source, target);
  await preparePackageForOpen(source);
  await fs.writeFile(path.join(target, '.metadata/notes.txt'), 'Later edit');
  const before = await packageCopyDigest(source);
  const copyBefore = await packageCopyDigest(target);
  const siblings = await fs.readdir(path.dirname(source));
  const controller = new AbortController();
  const snapshot = sourceSnapshot.snapshotPackageSource;
  let targetReads = 0;
  vi.spyOn(sourceSnapshot, 'snapshotPackageSource').mockImplementation(
    async (...args) => {
      const result = await snapshot(...args);
      if (args[0] === target && ++targetReads === 2) controller.abort();
      return result;
    },
  );
  const choose = vi.fn(async () => target);
  await expect(
    preparePackageForOpen(source, {
      choose,
      historyRead: { signal: controller.signal },
    }),
  ).rejects.toThrow('PACKAGE_OPEN_CANCELLED');
  expect(targetReads).toBe(2);
  expect(choose).not.toHaveBeenCalled();
  expect(await packageCopyDigest(source)).toBe(before);
  expect(await packageCopyDigest(target)).toBe(copyBefore);
  expect(await fs.readdir(path.dirname(source))).toEqual(siblings);
});
