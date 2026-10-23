import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { preparePackageForOpen } from './legacyPackageMigrationService';
import { prepareLegacyPackageCopy } from './legacyPackageCopyService';
import { PackageMigrationIndex } from './packageMigrationIndex';
import { packageCopyDigest } from './packageCopyDigest';
import { isPackageRestoredFromBackup } from './packageBackupRestoration';
import { UPDATE_RECEIPT } from './packageUpdateJournal';

const roots: string[] = [];
const originalChoice = async ({
  source,
}: {
  source: string;
}): Promise<string> => source;
const setMemo = async (source: string, memo: string): Promise<void> => {
  const file = path.join(source, 'timeline.json');
  const data = JSON.parse(await fs.readFile(file, 'utf8'));
  (Array.isArray(data) ? data : data.instances)[0].memo = memo;
  await fs.writeFile(file, JSON.stringify(data));
};
const memoAt = async (source: string): Promise<string> => {
  const data = JSON.parse(
    await fs.readFile(path.join(source, 'timeline.json'), 'utf8'),
  );
  return (Array.isArray(data) ? data : data.instances)[0].memo;
};
const fixture = async (withCopy: boolean) => {
  const root = await fs.realpath(
    await fs.mkdtemp(path.join(os.tmpdir(), 'restored-open-')),
  );
  roots.push(root);
  const source = path.join(root, 'Sample.stpkg');
  const retained = path.join(root, 'Retained.stpkg');
  const copy = path.join(root, 'Earlier.stpkg');
  const index = new PackageMigrationIndex(path.join(root, 'index.json'));
  await fs.mkdir(path.join(source, '.metadata'), { recursive: true });
  await fs.writeFile(path.join(source, 'video.mp4'), Buffer.from([0, 1, 2, 3]));
  await fs.writeFile(
    path.join(source, '.metadata/config.json'),
    JSON.stringify({ tightViewPath: path.join(source, 'video.mp4') }),
  );
  await fs.writeFile(
    path.join(source, 'timeline.json'),
    JSON.stringify([
      {
        id: 'event',
        actionName: 'Play',
        startTime: 1,
        endTime: 2,
        memo: 'Original',
      },
    ]),
  );
  if (withCopy) {
    await prepareLegacyPackageCopy(source, copy, index);
    await setMemo(copy, 'Earlier copy edit');
  }
  const before = await packageCopyDigest(source);
  const updated = await preparePackageForOpen(source, {
    index,
    choose: originalChoice,
  });
  await setMemo(source, 'Current edit retained');
  const retainedDigest = await packageCopyDigest(source);
  await fs.rename(source, retained);
  await fs.rename(updated.backupPath!, source);
  expect(await packageCopyDigest(source)).toBe(before);
  return {
    root,
    source,
    copy,
    index,
    retained,
    retainedDigest,
    before,
    backup: path.dirname(path.dirname(updated.backupPath!)),
  };
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
  'honors a restored original, preserving retained edits and repeating no conversion; earlier copy=%s',
  async (withCopy) => {
    const { root, source, copy, index, retained, retainedDigest, before } =
      await fixture(withCopy);
    const copyDigest = withCopy ? await packageCopyDigest(copy) : undefined;
    await expect(
      preparePackageForOpen(source, { index, choose: async () => null }),
    ).rejects.toThrow('PACKAGE_MIGRATION_CANCELLED');
    expect(await packageCopyDigest(source)).toBe(before);
    expect(await packageCopyDigest(retained)).toBe(retainedDigest);
    const choose = vi.fn(originalChoice);
    const result = await preparePackageForOpen(source, { index, choose });
    expect(choose).toHaveBeenCalledExactlyOnceWith({
      source,
      candidates: withCopy ? [copy] : [],
      reason: 'restored',
    });
    expect(result.packagePath).toBe(source);
    expect(result.migrated).toBe(true);
    expect(await memoAt(source)).toBe('Original');
    expect(await packageCopyDigest(result.backupPath!)).toBe(before);
    await setMemo(source, 'Saved after restoration');
    choose.mockClear();
    expect(
      (await preparePackageForOpen(source, { index, choose })).migrated,
    ).toBe(false);
    expect(choose).not.toHaveBeenCalled();
    expect(await memoAt(source)).toBe('Saved after restoration');
    expect(await packageCopyDigest(retained)).toBe(retainedDigest);
    if (withCopy) expect(await packageCopyDigest(copy)).toBe(copyDigest);
    expect(
      (await fs.readdir(root)).filter((name) => name.includes('.backup-')),
    ).toHaveLength(2);
  },
);

it('allows explicitly selecting the retained current document, even when its migration marker names a previous copy', async () => {
  const { source, copy, index, retained, retainedDigest } = await fixture(true);
  const copyDigest = await packageCopyDigest(copy);
  const choose = vi.fn(async () => retained);
  expect(
    (await preparePackageForOpen(source, { index, choose })).packagePath,
  ).toBe(source);
  expect(choose.mock.calls).toHaveLength(1);
  expect(await memoAt(source)).toBe('Current edit retained');
  expect(await packageCopyDigest(retained)).toBe(retainedDigest);
  expect(await packageCopyDigest(copy)).toBe(copyDigest);
  expect((await preparePackageForOpen(source, { index })).migrated).toBe(false);
});

it('detects restoration of a later generation that already contains a receipt', async () => {
  const { root, source, copy, index, retained } = await fixture(true);
  // Put the first installed generation back, then explicitly adopt a newer copy.
  await fs.rename(source, path.join(root, 'Original saved.stpkg'));
  await fs.rename(retained, source);
  const prior = await packageCopyDigest(source);
  await setMemo(copy, 'Newer copy edit');
  const updated = await preparePackageForOpen(source, {
    index,
    choose: async () => copy,
  });
  await fs.rename(source, retained);
  const retainedDigest = await packageCopyDigest(retained);
  await fs.rename(updated.backupPath!, source);
  expect(await packageCopyDigest(source)).toBe(prior);
  const choose = vi.fn(originalChoice);
  await preparePackageForOpen(source, { index, choose });
  expect(choose).toHaveBeenCalledExactlyOnceWith({
    source,
    candidates: [copy],
    reason: 'restored',
  });
  expect(await memoAt(source)).toBe('Current edit retained');
  expect(await packageCopyDigest(retained)).toBe(retainedDigest);
  choose.mockClear();
  expect(
    (await preparePackageForOpen(source, { index, choose })).migrated,
  ).toBe(false);
  expect(choose).not.toHaveBeenCalled();
});

it('recognizes completed journals from before source receipt identity was recorded', async () => {
  const { source, backup } = await fixture(true);
  const file = path.join(backup, 'transaction.json');
  const journal = JSON.parse(await fs.readFile(file, 'utf8'));
  delete journal.sourceReceiptId;
  await fs.writeFile(file, JSON.stringify(journal));
  expect(await isPackageRestoredFromBackup(source)).toBe(true);
});

it.each([
  'source',
  'id',
  'backupPath',
  'sourceDigest',
  'phase',
  'sourceReceiptId',
])(
  'retains all contents when a completed backup journal has an invalid %s',
  async (field) => {
    const { source, retained, retainedDigest, before, backup } =
      await fixture(true);
    const file = path.join(backup, 'transaction.json');
    const journal = JSON.parse(await fs.readFile(file, 'utf8'));
    journal[field] = 'invalid';
    await fs.writeFile(file, JSON.stringify(journal));
    await expect(
      preparePackageForOpen(source, { choose: originalChoice }),
    ).rejects.toThrow('PACKAGE_UPDATE_BACKUP_HISTORY_INVALID');
    expect(await packageCopyDigest(source)).toBe(before);
    expect(await packageCopyDigest(retained)).toBe(retainedDigest);
  },
);

it('does not follow a symlink in completed backup history', async () => {
  const { source, retained, retainedDigest, before, backup } =
    await fixture(false);
  const moved = `${backup}-retained`;
  await fs.rename(backup, moved);
  await fs.symlink(
    moved,
    backup,
    process.platform === 'win32' ? 'junction' : 'dir',
  );
  await expect(
    preparePackageForOpen(source, { choose: originalChoice }),
  ).rejects.toThrow('PACKAGE_UPDATE_BACKUP_HISTORY_INVALID');
  expect(await packageCopyDigest(source)).toBe(before);
  expect(await packageCopyDigest(retained)).toBe(retainedDigest);
});

it('does not read video contents on ordinary repeated opens with new journals', async () => {
  const { source, index, retained, root } = await fixture(false);
  await fs.rename(source, path.join(root, 'Restored aside.stpkg'));
  await fs.rename(retained, source);
  const receipt = JSON.parse(
    await fs.readFile(path.join(source, UPDATE_RECEIPT), 'utf8'),
  );
  expect(receipt.source).toBe(source);
  const readdir = fs.readdir.bind(fs);
  vi.spyOn(fs, 'readdir').mockImplementation((...args) => {
    if (String(args[0]) === source)
      throw new Error('Unexpected full digest scan');
    return Reflect.apply(readdir, fs, args);
  });
  expect(await isPackageRestoredFromBackup(source)).toBe(false);
  // The full Open also checks package metadata; the no-hash assertion above is
  // scoped to backup detection so it does not prohibit normal validation reads.
  vi.restoreAllMocks();
  expect((await preparePackageForOpen(source, { index })).migrated).toBe(false);
});

it.each(['copy', 'move'])(
  'opens a completed document after a whole enclosing folder and backup %s',
  async (operation) => {
    const { root, source, retained } = await fixture(false);
    await fs.rename(source, path.join(root, 'Original aside.stpkg'));
    await fs.rename(retained, source);
    const destination = `${root}-relocated`;
    roots.push(destination);
    if (operation === 'copy')
      await fs.cp(root, destination, { recursive: true });
    else await fs.rename(root, destination);
    const moved = path.join(destination, path.basename(source));
    const before = await packageCopyDigest(moved);
    const choose = vi.fn(originalChoice);
    expect((await preparePackageForOpen(moved, { choose })).migrated).toBe(
      false,
    );
    expect(choose).not.toHaveBeenCalled();
    expect(await packageCopyDigest(moved)).toBe(before);
  },
);

it('opens a restored legacy document after its enclosing folder was moved', async () => {
  const { root, source } = await fixture(true);
  // A relative legacy reference remains valid after a whole-folder move.
  await fs.writeFile(
    path.join(source, '.metadata/config.json'),
    JSON.stringify({ tightViewPath: 'video.mp4' }),
  );
  const destination = `${root}-relocated`;
  roots.push(destination);
  await fs.rename(root, destination);
  const moved = path.join(destination, path.basename(source));
  const before = await packageCopyDigest(moved);
  const choose = vi.fn(originalChoice);
  const result = await preparePackageForOpen(moved, { choose });
  expect(choose).toHaveBeenCalledExactlyOnceWith({
    source: moved,
    candidates: [],
    reason: 'untracked',
  });
  expect(result.packagePath).toBe(moved);
  expect(await memoAt(moved)).toBe('Original');
  expect(await packageCopyDigest(result.backupPath!)).toBe(before);
});

it('cancels delayed sibling enumeration without adopting or writing, and permits retry', async () => {
  const { source, before, root } = await fixture(false);
  const readdir = fs.readdir.bind(fs);
  let release: (value: string[]) => void = () => undefined;
  const deferred = new Promise<string[]>((resolve) => {
    release = resolve;
  });
  const reading = vi.spyOn(fs, 'readdir').mockImplementation((...args) => {
    if (String(args[0]) === root && args.length === 1) return deferred;
    return Reflect.apply(readdir, fs, args);
  });
  const controller = new AbortController();
  const waiting = vi.fn();
  const choose = vi.fn(originalChoice);
  const pending = preparePackageForOpen(source, {
    choose,
    historyRead: { signal: controller.signal, directoryWaiting: waiting },
  });
  const outcome = expect(pending).rejects.toThrow('PACKAGE_OPEN_CANCELLED');
  await vi.waitFor(() => expect(waiting).toHaveBeenCalledWith(true));
  controller.abort();
  await outcome;
  reading.mockRestore();
  release(await fs.readdir(root));
  await Promise.resolve();
  expect(choose).not.toHaveBeenCalled();
  expect(await packageCopyDigest(source)).toBe(before);
  await expect(
    preparePackageForOpen(source, { choose: async () => null }),
  ).rejects.toThrow('PACKAGE_MIGRATION_CANCELLED');
  expect(await packageCopyDigest(source)).toBe(before);
});
