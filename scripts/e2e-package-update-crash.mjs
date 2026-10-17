import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const service = path.resolve(
  'build/electron/src/ipc/legacyPackageMigrationService.js',
);
const copyService = path.resolve(
  'build/electron/src/ipc/legacyPackageCopyService.js',
);
const digestModule = path.resolve(
  'build/electron/src/ipc/packageCopyDigest.js',
);
const { packageCopyDigest } = require(digestModule);

const child = String.raw`
const fs = require('node:fs/promises');
const path = require('node:path');
const [service, source, stop] = process.argv.slice(1);
let journals = 0;
const halt = phase => { if (stop === phase) process.exit(86); };
const mkdir = fs.mkdir.bind(fs);
fs.mkdir = async (file, options) => {
  const result = await mkdir(file, options);
  if (path.basename(String(file)).startsWith('.sportag-update-')) halt('work');
  if (path.basename(String(file)) === 'original') halt('original-parent');
  return result;
};
const cp = fs.cp.bind(fs);
fs.cp = async (...args) => { await cp(...args); halt('copy'); };
const rename = fs.rename.bind(fs);
fs.rename = async (from, to) => {
  await rename(from, to);
  if (String(to).endsWith('transaction.json')) {
    journals++;
    halt('journal-' + journals);
  }
  if (from === source) halt('original-moved');
  if (String(from).endsWith('.sportag-migrating-prepared') && to === source) halt('published');
  if (String(to).includes('.backup-')) halt('backup-finalized');
};
require(service).preparePackageForOpen(source, { choose: async ({source}) => source })
  .then(result => { process.stdout.write(JSON.stringify(result)); })
  .catch(error => { console.error(error); process.exitCode = 1; });
`;

export const exercisePackageUpdateCrash = async () => {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), 'package-update-crash-'),
  );
  try {
    for (const phase of [
      'work',
      'original-parent',
      'journal-1',
      'copy',
      'journal-2',
      'original-moved',
      'published',
      'journal-3',
      'backup-finalized',
    ]) {
      const parent = path.join(root, phase);
      let source = path.join(parent, 'Synthetic original');
      await fs.mkdir(path.join(source, '.metadata'), { recursive: true });
      await fs.writeFile(
        path.join(source, 'media.mp4'),
        Buffer.from([0, 1, 2, 3]),
      );
      await fs.writeFile(
        path.join(source, '.metadata/config.json'),
        JSON.stringify({ tightViewPath: path.join(source, 'media.mp4') }),
      );
      await fs.writeFile(
        path.join(source, 'timeline.json'),
        JSON.stringify([
          { id: 'event', actionName: 'Play', startTime: 1, endTime: 2 },
        ]),
      );
      source = await fs.realpath(source);
      const originalDigest = await packageCopyDigest(source);
      // Historical sibling makes the extensionless-path recovery order observable.
      const copied =
        await require(copyService).prepareLegacyPackageCopy(source);
      const copiedTimeline = path.join(copied.packagePath, 'timeline.json');
      const document = JSON.parse(await fs.readFile(copiedTimeline, 'utf8'));
      document.instances[0].memo = 'Preserved edit from 0.17.9';
      await fs.writeFile(copiedTimeline, JSON.stringify(document));
      const stopped = spawnSync(
        process.execPath,
        ['-e', child, service, source, phase],
        { encoding: 'utf8', timeout: 30_000 },
      );
      assert.equal(stopped.status, 86, `${phase}: ${stopped.stderr}`);
      if (phase === 'published')
        await fs.writeFile(
          path.join(source, '.DS_Store'),
          'Finder metadata after publish',
        );
      const resumed = spawnSync(
        process.execPath,
        ['-e', child, service, source, 'never'],
        { encoding: 'utf8', timeout: 30_000 },
      );
      assert.equal(resumed.status, 0, `${phase}: ${resumed.stderr}`);
      // conversion warnings go to stdout too; take the final JSON object line.
      const result = JSON.parse(
        resumed.stdout.slice(resumed.stdout.lastIndexOf('{"status"')),
      );
      assert.equal(result.packagePath, await fs.realpath(source));
      assert.equal(
        JSON.parse(
          await fs.readFile(path.join(source, 'timeline.json'), 'utf8'),
        ).instances[0].memo,
        'Preserved edit from 0.17.9',
      );
      const backups = (await fs.readdir(parent)).filter((name) =>
        name.includes('.backup-'),
      );
      assert.equal(backups.length, 1, phase);
      assert.equal(
        await packageCopyDigest(
          path.join(parent, backups[0], 'original', path.basename(source)),
        ),
        originalDigest,
        phase,
      );
      assert.equal(
        (await fs.readdir(parent)).some((name) =>
          name.startsWith('.sportag-update-'),
        ),
        false,
        phase,
      );
      console.log(
        `Package update process termination/restart passed: ${phase}`,
      );
    }
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
};

if (process.argv[1] === new URL(import.meta.url).pathname)
  await exercisePackageUpdateCrash();
