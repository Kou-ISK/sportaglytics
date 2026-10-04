import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

// Only synthetic fixtures, through the installed preload/main preparation API.
export const exercisePackageMigration = async (
  main,
  root,
  current,
  document,
) => {
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
    const migrated = await prepare();
    assert.equal(migrated.status, 'ready');
    assert.equal(migrated.migrated, true);
    assert.equal(migrated.reused, false);
    assert.notEqual(migrated.packagePath, source);
    assert.ok(migrated.packagePath.endsWith('.stpkg'));
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
    assert.equal(reused.reused, true);
    assert.equal(await fs.readFile(configFile, 'utf8'), config);
    assert.equal(await fs.readFile(timelineFile, 'utf8'), timeline);
    // Windows chmod has different ACL semantics; POSIX mode preservation is asserted on macOS.
    if (process.platform !== 'win32') {
      assert.equal((await fs.stat(configFile)).mode & 0o777, 0o444);
      assert.equal((await fs.stat(timelineFile)).mode & 0o777, 0o444);
    }
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
    'Package migration: read-only legacy folder/old .stpkg originals retained, v2 copied, repeat reused, future/unknown/native/missing media rejected',
  );
};
