import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { preparePackageForOpen } from './legacyPackageMigrationService';
import { prepareLegacyPackageCopy } from './legacyPackageCopyService';
import { PackageMigrationIndex } from './packageMigrationIndex';
import { packageCopyDigest } from './packageCopyDigest';
import { packageUpdatePaths, strictPathExists } from './packageUpdateJournal';

const roots: string[] = [];
const fixture = async (
  name = 'Sample.stpkg',
): Promise<{ root: string; source: string }> => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'in-place-open-'));
  roots.push(root);
  const source = path.join(root, name);
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
  return { root, source: await fs.realpath(source) };
};
const useOriginal = async ({ source }: { source: string }): Promise<string> =>
  source;
const open = (source: string): ReturnType<typeof preparePackageForOpen> =>
  preparePackageForOpen(source, { choose: useOriginal });
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(
    roots
      .splice(0)
      .map((root) => fs.rm(root, { recursive: true, force: true })),
  );
});

it.each(['Sample.stpkg', 'Without extension', 'ライブ 🏉.stpkg'])(
  'updates at the exact original name, retains a byte-identical backup, and does not repeat: %s',
  async (name) => {
    const { root, source } = await fixture(name);
    const before = await packageCopyDigest(source);
    const result = await open(source);
    expect(result.packagePath).toBe(source);
    expect(result.migrated).toBe(true);
    expect(await packageCopyDigest(result.backupPath!)).toBe(before);
    expect((await open(source)).migrated).toBe(false);
    expect(
      (await fs.readdir(root)).filter((entry) => entry.includes('.backup-')),
    ).toHaveLength(1);
    expect(
      (await fs.readdir(root)).some((entry) =>
        entry.startsWith('.sportag-update-'),
      ),
    ).toBe(false);
    const timelinePath = path.join(source, 'timeline.json');
    const document = JSON.parse(await fs.readFile(timelinePath, 'utf8'));
    document.instances[0].memo = 'Saved at original path';
    await fs.writeFile(timelinePath, JSON.stringify(document));
    await open(source);
    expect(
      JSON.parse(await fs.readFile(timelinePath, 'utf8')).instances[0].memo,
    ).toBe('Saved at original path');
    await expect(open(result.backupPath!)).rejects.toThrow(
      'PACKAGE_UPDATE_BACKUP_SELECTED',
    );
  },
);

it('adopts all edits from an indexed 0.17.9 copy and redirects unchanged old-copy opens', async () => {
  const { root, source } = await fixture();
  await fs.mkdir(path.join(root, 'elsewhere'));
  const target = path.join(root, 'elsewhere', 'Edited.stpkg');
  const index = new PackageMigrationIndex(path.join(root, 'index.json'));
  await prepareLegacyPackageCopy(source, target, index);
  const timeline = path.join(target, 'timeline.json');
  const document = JSON.parse(await fs.readFile(timeline, 'utf8'));
  document.instances[0].memo = 'Edited in 0.17.9';
  await fs.writeFile(timeline, JSON.stringify(document));
  await fs.writeFile(
    path.join(target, '.metadata/notes.txt'),
    'Keep all edits',
  );
  const copyDigest = await packageCopyDigest(target);
  const result = await preparePackageForOpen(source, { index });
  expect(result.packagePath).toBe(source);
  expect(
    JSON.parse(await fs.readFile(path.join(source, 'timeline.json'), 'utf8'))
      .instances[0].memo,
  ).toBe('Edited in 0.17.9');
  expect(
    await fs.readFile(path.join(source, '.metadata/notes.txt'), 'utf8'),
  ).toBe('Keep all edits');
  expect(await packageCopyDigest(target)).toBe(copyDigest);
  expect((await preparePackageForOpen(target)).packagePath).toBe(source);
  await fs.writeFile(
    path.join(target, '.metadata/notes.txt'),
    'A later branch',
  );
  await expect(preparePackageForOpen(target)).rejects.toThrow(
    'PACKAGE_UPDATE_COPY_DIVERGED',
  );
  await expect(preparePackageForOpen(source)).rejects.toThrow(
    'PACKAGE_UPDATE_COPY_DIVERGED',
  );
});

it('finds a sibling edited copy without an index and does not choose by filename order', async () => {
  const { source } = await fixture();
  const copied = await prepareLegacyPackageCopy(source);
  if (copied.status !== 'ready') throw new Error('fixture');
  await fs.writeFile(
    path.join(copied.packagePath, '.metadata/notes.txt'),
    'Edited',
  );
  const choose = vi.fn(useOriginal);
  expect((await preparePackageForOpen(source, { choose })).reused).toBe(true);
  expect(choose).not.toHaveBeenCalled();
});

it.each(['copy', 'move'])(
  'opens an updated package after a normal %s without confusing its history with a conflicting edit',
  async (operation) => {
    const { root, source } = await fixture();
    await open(source);
    const destination = path.join(root, 'Another document.stpkg');
    if (operation === 'copy')
      await fs.cp(source, destination, { recursive: true });
    else await fs.rename(source, destination);
    const choose = vi.fn(useOriginal);
    for (let attempt = 0; attempt < 2; attempt++) {
      const result = await preparePackageForOpen(destination, { choose });
      expect(result.packagePath).toBe(await fs.realpath(destination));
      expect(result.migrated).toBe(false);
    }
    expect(choose).not.toHaveBeenCalled();
    expect(
      (await fs.readdir(root)).filter((entry) => entry.includes('.backup-')),
    ).toHaveLength(1);
  },
);

it('does not replace a package that changed while a later copy conflict was being resolved', async () => {
  const { source } = await fixture();
  const copied = await prepareLegacyPackageCopy(source);
  if (copied.status !== 'ready') throw new Error('fixture');
  await preparePackageForOpen(source);
  await fs.writeFile(
    path.join(copied.packagePath, '.metadata/notes.txt'),
    'Later copy edit',
  );
  await expect(
    preparePackageForOpen(source, {
      choose: async () => {
        await fs.writeFile(
          path.join(source, '.metadata/notes.txt'),
          'Concurrent edit at original path',
        );
        return copied.packagePath;
      },
    }),
  ).rejects.toThrow('PACKAGE_SOURCE_CHANGED');
  expect(
    await fs.readFile(path.join(source, '.metadata/notes.txt'), 'utf8'),
  ).toBe('Concurrent edit at original path');
});

it.each([false, true])(
  'adopts 0.17.9 edits even when the extensionless original already uses the current schema; index=%s',
  async (indexed) => {
    const { root, source } = await fixture('Current content without suffix');
    const config = {
      packageFormatVersion: 1,
      primaryAngleId: 'main',
      angles: [
        {
          id: 'main',
          name: 'Main',
          sourceKind: 'local',
          relativePath: 'video.mp4',
          clips: [
            {
              id: 'clip',
              sourceKind: 'local',
              relativePath: 'video.mp4',
              gapBeforeSeconds: 0,
            },
          ],
        },
      ],
    };
    const document = {
      version: 2,
      rows: [{ id: 'row', name: 'Play', color: '#123456' }],
      instances: [
        {
          id: 'event',
          actionName: 'Play',
          startTime: 1,
          endTime: 2,
          memo: 'Original current schema',
        },
      ],
    };
    await fs.writeFile(
      path.join(source, '.metadata/config.json'),
      JSON.stringify(config),
    );
    await fs.writeFile(
      path.join(source, 'timeline.json'),
      JSON.stringify(document),
    );
    const before = await packageCopyDigest(source);
    const index = indexed
      ? new PackageMigrationIndex(path.join(root, 'index.json'))
      : undefined;
    const destination = indexed
      ? path.join(root, 'Elsewhere', 'Copy.stpkg')
      : undefined;
    if (destination) await fs.mkdir(path.dirname(destination));
    const copied = await prepareLegacyPackageCopy(source, destination, index);
    if (copied.status !== 'ready' || copied.packagePath === source)
      throw new Error('Historical extension-only fixture did not migrate');
    document.instances[0].memo = 'Edited copy must win';
    await fs.writeFile(
      path.join(copied.packagePath, 'timeline.json'),
      JSON.stringify(document),
    );
    const result = await preparePackageForOpen(source, { index });
    expect(result.packagePath).toBe(source);
    expect(result.migrated).toBe(true);
    expect(
      JSON.parse(await fs.readFile(path.join(source, 'timeline.json'), 'utf8'))
        .instances[0].memo,
    ).toBe('Edited copy must win');
    expect(await packageCopyDigest(result.backupPath!)).toBe(before);
    expect((await preparePackageForOpen(source, { index })).migrated).toBe(
      false,
    );
  },
);

it('requires an explicit choice for all historical revisions, preserving both branches', async () => {
  const { root, source } = await fixture();
  const index = new PackageMigrationIndex(path.join(root, 'index.json'));
  const target = path.join(root, 'First.stpkg');
  await prepareLegacyPackageCopy(source, target, index);
  await fs.writeFile(
    path.join(source, '.metadata/notes.txt'),
    'Changed original',
  );
  const original = await packageCopyDigest(source);
  const copy = await packageCopyDigest(target);
  await expect(preparePackageForOpen(source, { index })).rejects.toThrow(
    'PACKAGE_UPDATE_CHOICE_REQUIRED',
  );
  expect(await packageCopyDigest(source)).toBe(original);
  expect(await packageCopyDigest(target)).toBe(copy);
  const choose = vi.fn(async () => target);
  const result = await preparePackageForOpen(source, { index, choose });
  expect(choose.mock.calls).toHaveLength(1);
  expect(await packageCopyDigest(result.backupPath!)).toBe(original);
  expect(await packageCopyDigest(target)).toBe(copy);
});

it('allows locating a moved registered copy; cancellation and unknown copies cannot overwrite', async () => {
  const { root, source } = await fixture();
  const index = new PackageMigrationIndex(path.join(root, 'index.json'));
  const target = path.join(root, 'First.stpkg');
  await prepareLegacyPackageCopy(source, target, index);
  const moved = path.join(root, 'Moved.stpkg');
  await fs.rename(target, moved);
  const before = await packageCopyDigest(source);
  await expect(
    preparePackageForOpen(source, { index, choose: async () => null }),
  ).rejects.toThrow('PACKAGE_MIGRATION_CANCELLED');
  expect(await packageCopyDigest(source)).toBe(before);
  expect(
    (await preparePackageForOpen(source, { index, choose: async () => moved }))
      .packagePath,
  ).toBe(source);
});

it.each(['EACCES', 'ENOSPC', 'EIO'])(
  'retains the original and cleans partial copies on %s',
  async (code) => {
    const { root, source } = await fixture();
    const before = await packageCopyDigest(source);
    vi.spyOn(fs, 'cp').mockRejectedValueOnce(
      Object.assign(new Error(code), { code }),
    );
    await expect(open(source)).rejects.toThrow(code);
    expect(await packageCopyDigest(source)).toBe(before);
    expect(await fs.readdir(root)).toEqual(['Sample.stpkg']);
  },
);

it('rolls back a failed publication and can retry once without a duplicate backup', async () => {
  const { root, source } = await fixture();
  const before = await packageCopyDigest(source);
  const rename = fs.rename.bind(fs);
  vi.spyOn(fs, 'rename').mockImplementation(async (from, to) => {
    if (String(from).endsWith('.sportag-migrating-prepared') && to === source)
      throw Object.assign(new Error('EACCES'), { code: 'EACCES' });
    await rename(from, to);
  });
  await expect(open(source)).rejects.toThrow('EACCES');
  expect(await packageCopyDigest(source)).toBe(before);
  expect(await fs.readdir(root)).toEqual(['Sample.stpkg']);
  vi.restoreAllMocks();
  await open(source);
  expect(
    (await fs.readdir(root)).filter((entry) => entry.includes('.backup-')),
  ).toHaveLength(1);
});

it('keeps the journal and original when publication and rollback fail, then recovers a missing path', async () => {
  const { source } = await fixture();
  const before = await packageCopyDigest(source);
  const rename = fs.rename.bind(fs);
  vi.spyOn(fs, 'rename').mockImplementation(async (from, to) => {
    if (to === source)
      throw new Error('Synthetic denied publication and rollback');
    await rename(from, to);
  });
  await expect(open(source)).rejects.toThrow(
    'PACKAGE_UPDATE_RECOVERY_REQUIRED',
  );
  expect(await strictPathExists(source)).toBe(false);
  expect(await packageCopyDigest(packageUpdatePaths(source).original)).toBe(
    before,
  );
  vi.restoreAllMocks();
  const result = await open(source);
  expect(await packageCopyDigest(result.backupPath!)).toBe(before);
  expect(await strictPathExists(packageUpdatePaths(source).work)).toBe(false);
});

it('recognizes a completed rename even when the next journal write failed', async () => {
  const { source } = await fixture();
  const before = await packageCopyDigest(source);
  const rename = fs.rename.bind(fs);
  let published = false;
  vi.spyOn(fs, 'rename').mockImplementation(async (from, to) => {
    if (published && String(to).endsWith('transaction.json'))
      throw new Error('Journal denied');
    await rename(from, to);
    if (String(from).endsWith('.sportag-migrating-prepared') && to === source)
      published = true;
  });
  await expect(open(source)).rejects.toThrow(
    'PACKAGE_UPDATE_RECOVERY_REQUIRED',
  );
  vi.restoreAllMocks();
  // A failed journal write can leave the live pid; emulate the recorded process exit.
  const file = packageUpdatePaths(source).journal;
  const journal = JSON.parse(await fs.readFile(file, 'utf8'));
  journal.pid = 0;
  await fs.writeFile(file, JSON.stringify(journal));
  const result = await open(source);
  expect(result.migrated).toBe(true);
  expect(await packageCopyDigest(result.backupPath!)).toBe(before);
});

it('rejects same-size copy corruption and an active owner before mutating originals', async () => {
  const { source } = await fixture();
  const before = await packageCopyDigest(source);
  const cp = fs.cp.bind(fs);
  vi.spyOn(fs, 'cp').mockImplementation(async (from, to, options) => {
    await cp(from, to, options);
    await fs.writeFile(
      path.join(String(to), 'video.mp4'),
      Buffer.from([9, 9, 9, 9]),
    );
  });
  await expect(open(source)).rejects.toThrow('PACKAGE_MIGRATION_COPY_INVALID');
  expect(await packageCopyDigest(source)).toBe(before);
  vi.restoreAllMocks();
  await expect(
    preparePackageForOpen(source, {
      choose: useOriginal,
      assertAvailable: () => {
        throw new Error('PACKAGE_UPDATE_BUSY');
      },
    }),
  ).rejects.toThrow('PACKAGE_UPDATE_BUSY');
  expect(await packageCopyDigest(source)).toBe(before);
});

it('does not follow a selected root symlink or replace an unrelated path appearing during commit', async () => {
  const { root, source } = await fixture();
  const link = path.join(root, 'Alias.stpkg');
  await fs.symlink(
    source,
    link,
    process.platform === 'win32' ? 'junction' : 'dir',
  );
  await expect(open(link)).rejects.toThrow('PACKAGE_SOURCE_NOT_DIRECTORY');
  const rename = fs.rename.bind(fs);
  vi.spyOn(fs, 'rename').mockImplementation(async (from, to) => {
    await rename(from, to);
    if (from === source) {
      await fs.mkdir(source);
      await fs.writeFile(path.join(source, 'unrelated'), 'Keep');
    }
  });
  await expect(open(source)).rejects.toThrow(
    'PACKAGE_UPDATE_RECOVERY_REQUIRED',
  );
  expect(await fs.readFile(path.join(source, 'unrelated'), 'utf8')).toBe(
    'Keep',
  );
  expect(await strictPathExists(packageUpdatePaths(source).original)).toBe(
    true,
  );
});

it('detects changes while the content choice is open and while the selected copy is being copied', async () => {
  const { source } = await fixture();
  await expect(
    preparePackageForOpen(source, {
      choose: async () => {
        await fs.writeFile(
          path.join(source, '.metadata/notes.txt'),
          'New original edit',
        );
        return source;
      },
    }),
  ).rejects.toThrow('PACKAGE_SOURCE_CHANGED');
  const copied = await prepareLegacyPackageCopy(source);
  if (copied.status !== 'ready') throw new Error('fixture');
  const before = await packageCopyDigest(source);
  const cp = fs.cp.bind(fs);
  vi.spyOn(fs, 'cp').mockImplementation(async (from, to, options) => {
    await cp(from, to, options);
    await fs.writeFile(
      path.join(String(from), '.metadata/notes.txt'),
      'Changed during copy',
    );
  });
  await expect(open(source)).rejects.toThrow('PACKAGE_SOURCE_CHANGED');
  expect(await packageCopyDigest(source)).toBe(before);
});

it.each([false, true])(
  'rejects a candidate referencing media inside the original before moving it, including parent aliases: %s',
  async (alias) => {
    const { root, source } = await fixture();
    const copied = await prepareLegacyPackageCopy(source);
    if (copied.status !== 'ready') throw new Error('fixture');
    const configPath = path.join(copied.packagePath, '.metadata/config.json');
    const config = JSON.parse(await fs.readFile(configPath, 'utf8'));
    const parentAlias = path.join(root, 'Parent alias');
    if (alias)
      await fs.symlink(
        path.dirname(source),
        parentAlias,
        process.platform === 'win32' ? 'junction' : 'dir',
      );
    const reference = path.join(
      alias ? path.join(parentAlias, path.basename(source)) : source,
      'video.mp4',
    );
    config.tightViewPath = reference;
    config.angles[0].clips[0].relativePath = reference;
    config.angles[0].relativePath = reference;
    await fs.writeFile(configPath, JSON.stringify(config));
    const before = await packageCopyDigest(source);
    await expect(open(source)).rejects.toThrow(
      'PACKAGE_UPDATE_REFERENCE_CONFLICT',
    );
    expect(await packageCopyDigest(source)).toBe(before);
  },
);

it('fails safely on permission or capacity preflight without weakening original permissions', async () => {
  const { root, source } = await fixture();
  const before = await packageCopyDigest(source);
  const realOpen = fs.open.bind(fs);
  vi.spyOn(fs, 'open').mockImplementation(async (file, flags, mode) => {
    if (file === path.join(source, 'timeline.json') && flags === 'r+')
      throw Object.assign(new Error('EACCES'), { code: 'EACCES' });
    return realOpen(file, flags, mode);
  });
  await expect(open(source)).rejects.toThrow('EACCES');
  expect(await fs.readdir(root)).toEqual(['Sample.stpkg']);
  vi.restoreAllMocks();
  const statfs = fs.statfs.bind(fs);
  vi.spyOn(fs, 'statfs').mockImplementation(async (file, options) => ({
    ...(await statfs(file, options)),
    bavail: 0n,
  }));
  await expect(open(source)).rejects.toThrow('PACKAGE_MIGRATION_SPACE');
  expect(await packageCopyDigest(source)).toBe(before);
});

it('recovers after a journal release-write failure in the same process', async () => {
  const { source } = await fixture();
  const rename = fs.rename.bind(fs);
  let published = false;
  vi.spyOn(fs, 'rename').mockImplementation(async (from, to) => {
    if (published && String(to).endsWith('transaction.json'))
      throw new Error('ENOSPC');
    await rename(from, to);
    if (String(from).endsWith('.sportag-migrating-prepared') && to === source)
      published = true;
  });
  await expect(open(source)).rejects.toThrow(
    'PACKAGE_UPDATE_RECOVERY_REQUIRED',
  );
  vi.restoreAllMocks();
  expect((await open(source)).migrated).toBe(true);
});

it('does not treat a reused PID as the owner and retains malformed recovery contents', async () => {
  const { source } = await fixture();
  const rename = fs.rename.bind(fs);
  vi.spyOn(fs, 'rename').mockImplementation(async (from, to) => {
    if (to === source) throw new Error('Denied');
    await rename(from, to);
  });
  await expect(open(source)).rejects.toThrow(
    'PACKAGE_UPDATE_RECOVERY_REQUIRED',
  );
  vi.restoreAllMocks();
  const file = packageUpdatePaths(source).journal;
  const journal = JSON.parse(await fs.readFile(file, 'utf8'));
  journal.pid = process.ppid;
  journal.ownerIdentity = 'A different process start';
  await fs.writeFile(file, JSON.stringify(journal));
  expect((await open(source)).migrated).toBe(true);
  const work = packageUpdatePaths(source).work;
  await fs.mkdir(work);
  await fs.writeFile(path.join(work, 'transaction.json'), '{corrupt');
  await fs.writeFile(path.join(work, 'retained'), 'Evidence');
  await expect(open(source)).rejects.toThrow(
    'PACKAGE_UPDATE_RECOVERY_REQUIRED',
  );
  expect(await fs.readFile(path.join(work, 'retained'), 'utf8')).toBe(
    'Evidence',
  );
});
