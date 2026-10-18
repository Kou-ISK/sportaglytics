import { execFileSync } from 'node:child_process';
import os from 'node:os';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

// Only synthetic fixtures, through the installed preload/main preparation API.
export const exercisePackageMigration = async (
  main,
  app,
  root,
  current,
  document,
) => {
  await app.evaluate(({ dialog }) => {
    const original = dialog.showMessageBox.bind(dialog);
    dialog.showMessageBox = async (...args) => {
      const options = args.at(-1);
      if (options.title === 'ファイルを開く') {
        const response =
          options.message === '開く内容を確認'
            ? options.buttons.indexOf('この場所の内容を使う')
            : 0;
        if (response < 0) throw new Error('Unexpected package choice');
        return { response, checkboxChecked: false };
      }
      return original(...args);
    };
  });
  for (const name of ['Legacy 日本語 #%', 'Legacy-old.stpkg']) {
    const source = path.join(root, name);
    await fs.cp(current, source, { recursive: true });
    const configFile = path.join(source, '.metadata/config.json');
    const timelineFile = path.join(source, 'timeline.json');
    const config = JSON.stringify({
      team1Name: 'Coral',
      team2Name: 'Falcon',
      tightViewPath: path.join(source, 'videos/synthetic.mp4'),
    });
    const timeline = JSON.stringify(document.instances);
    await fs.writeFile(configFile, config);
    await fs.writeFile(timelineFile, timeline);
    await fs.chmod(configFile, 0o444);
    await fs.chmod(timelineFile, 0o444);
    const prepare = () =>
      main.evaluate(
        (file) => window.electronAPI.preparePackageForOpen(file),
        source,
      );
    await assert.rejects(prepare(), /EACCES|EPERM|EROFS/);
    assert.equal(await fs.readFile(configFile, 'utf8'), config);
    assert.equal(await fs.readFile(timelineFile, 'utf8'), timeline);
    await fs.chmod(configFile, 0o644);
    await fs.chmod(timelineFile, 0o644);
    if (process.platform === 'win32') {
      const principal = os.userInfo().username;
      // Deny writes only on this disposable fixture; inherited parent rename
      // rights must not let the update bypass the document's ACL.
      execFileSync('icacls', [timelineFile, '/deny', `${principal}:(W)`], {
        stdio: 'pipe',
      });
      try {
        await assert.rejects(prepare(), /EACCES|EPERM/);
      } finally {
        execFileSync('icacls', [timelineFile, '/remove:d', principal], {
          stdio: 'pipe',
        });
      }
      assert.equal(await fs.readFile(timelineFile, 'utf8'), timeline);
    }
    const migrated = await prepare();
    assert.equal(migrated.status, 'ready');
    assert.equal(migrated.migrated, true);
    assert.equal(migrated.reused, false);
    assert.equal(migrated.packagePath, await fs.realpath(source));
    assert.ok(migrated.backupPath);
    const result = JSON.parse(
      await fs.readFile(
        path.join(migrated.packagePath, 'timeline.json'),
        'utf8',
      ),
    );
    assert.equal(result.version, 2);
    assert.deepEqual(result.instances, document.instances);
    assert.equal(result.rows[0].name, document.rows[0].name);
    const copiedConfig = JSON.parse(
      await fs.readFile(
        path.join(migrated.packagePath, '.metadata/config.json'),
        'utf8',
      ),
    );
    assert.equal(copiedConfig.packageFormatVersion, 1);
    assert.equal(
      copiedConfig.angles[0].clips[0].relativePath,
      'videos/synthetic.mp4',
    );
    const reused = await prepare();
    assert.equal(reused.packagePath, migrated.packagePath);
    assert.equal(reused.migrated, false);
    assert.equal(
      await fs.readFile(
        path.join(migrated.backupPath, '.metadata/config.json'),
        'utf8',
      ),
      config,
    );
    assert.equal(
      await fs.readFile(
        path.join(migrated.backupPath, 'timeline.json'),
        'utf8',
      ),
      timeline,
    );
  }
  for (const [name, mutate, expected] of [
    [
      'Future.stpkg',
      async (source) =>
        fs.writeFile(
          path.join(source, 'timeline.json'),
          JSON.stringify({ version: 99, rows: [], instances: [] }),
        ),
      /PACKAGE_TIMELINE_INVALID/,
    ],
    [
      'Unknown.stpkg',
      async (source) =>
        fs.writeFile(
          path.join(source, '.metadata/config.json'),
          JSON.stringify({ packageFormatVersion: 99 }),
        ),
      /PACKAGE_VERSION_UNSUPPORTED/,
    ],
    [
      'Missing.stpkg',
      async (source) => fs.rm(path.join(source, 'videos/synthetic.mp4')),
      /PACKAGE_MEDIA_MISSING/,
    ],
    ['Native.scpkg', async () => {}, /PACKAGE_SPORTSCODE_NATIVE_UNSUPPORTED/],
  ]) {
    const source = path.join(root, name);
    await fs.cp(current, source, { recursive: true });
    await mutate(source);
    const before = await fs.readFile(
      path.join(source, 'timeline.json'),
      'utf8',
    );
    await assert.rejects(
      main.evaluate(
        (file) => window.electronAPI.preparePackageForOpen(file),
        source,
      ),
      expected,
    );
    assert.equal(
      await fs.readFile(path.join(source, 'timeline.json'), 'utf8'),
      before,
    );
  }
  assert.equal(
    (await fs.readdir(root)).some((name) => name.includes('.migrating-')),
    false,
  );
  console.log(
    'Package migration: read-only originals rejected, same-name v2 update and backup preserved, repeat not converted, future/unknown/native/missing media rejected',
  );
};
