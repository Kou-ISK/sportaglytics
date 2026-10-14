import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import {
  sourceBundleOptions,
  sourcesForTargets,
} from '../media-tools/source-bundle.mjs';
import { validateReleaseIdentity } from '../macos/release-guard.mjs';

const python = process.platform === 'win32' ? 'python' : 'python3';
const archiveScript = resolve('scripts/media-tools/archive-sources.py');
const packageScript = resolve('scripts/package-media-sources.mjs');
const fresh = async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'sportaglytics-release-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
};

test('Mac source selection excludes Windows-only dependencies and requires both Mac targets', () => {
  const selected = sourceBundleOptions([
    '--platform',
    'macos',
    '--require-builds',
  ]);
  assert.deepEqual(selected, {
    platform: 'macos',
    requireBuilds: true,
    targets: ['darwin-x64', 'darwin-arm64'],
  });
  assert.deepEqual(Object.keys(sourcesForTargets(selected.targets)).sort(), [
    'ffmpeg',
    'freetype',
    'harfbuzz',
  ]);
  assert.equal(sourceBundleOptions([]).targets.length, 3);
  for (const args of [
    ['--platform'],
    ['--platform', 'linux'],
    ['--platform', 'macos', '--platform', 'all'],
    ['--typo'],
  ])
    assert.throws(() => sourceBundleOptions(args));
  assert.throws(() => sourcesForTargets(['darwin-typo']));
});

test('missing required build manifests stop before any source download', async (t) => {
  const root = await fresh(t);
  await writeFile(
    join(root, 'package.json'),
    JSON.stringify({ version: '1.2.3' }),
  );
  const result = spawnSync(
    process.execPath,
    [packageScript, '--platform', 'macos', '--require-builds'],
    { cwd: root, encoding: 'utf8' },
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /darwin-x64.*build\.json/);
  await assert.rejects(
    readFile(join(root, 'dist/media-tools-sources-1.2.3-macos.tar.gz')),
    /ENOENT/,
  );
});

test('source archive is repeatable, portable, and cannot replace an existing artifact', async (t) => {
  const root = await fresh(t),
    staging = join(root, 'stage');
  await mkdir(join(staging, 'scripts'), { recursive: true });
  await writeFile(
    join(staging, 'manifest.json'),
    '{"targets":["darwin-arm64"]}\n',
  );
  await writeFile(join(staging, 'scripts/build.mjs'), '// public recipe\n');
  const first = join(root, 'first.tar.gz'),
    second = join(root, 'second.tar.gz');
  execFileSync(python, [archiveScript, staging, first]);
  execFileSync(python, [archiveScript, staging, second]);
  assert.deepEqual(await readFile(first), await readFile(second));
  const inspection = JSON.parse(
    execFileSync(
      python,
      [
        '-c',
        `import json,sys,tarfile
with tarfile.open(sys.argv[1]) as a:
 print(json.dumps([{'name':x.name,'mtime':x.mtime,'uid':x.uid,'gid':x.gid,'pax':x.pax_headers} for x in a]))`,
        first,
      ],
      { encoding: 'utf8' },
    ),
  );
  assert.deepEqual(
    inspection.map((x) => x.name),
    [
      'media-tools-sources',
      'media-tools-sources/manifest.json',
      'media-tools-sources/scripts',
      'media-tools-sources/scripts/build.mjs',
    ],
  );
  assert.ok(
    inspection.every(
      (x) =>
        x.mtime === 0 &&
        x.uid === 0 &&
        x.gid === 0 &&
        Object.keys(x.pax).length === 0,
    ),
  );
  await writeFile(join(staging, 'manifest.json'), 'changed');
  assert.notEqual(spawnSync(python, [archiveScript, staging, first]).status, 0);
  assert.deepEqual(await readFile(first), await readFile(second));
});

test('source archive rejects filesystem metadata and symlinks without publishing a partial file', async (t) => {
  const root = await fresh(t),
    staging = join(root, 'stage');
  await mkdir(staging);
  const output = join(root, 'invalid.tar.gz');
  await writeFile(join(staging, '._secret'), 'metadata');
  assert.notEqual(
    spawnSync(python, [archiveScript, staging, output]).status,
    0,
  );
  await assert.rejects(readFile(output), /ENOENT/);
  await rm(join(staging, '._secret'));
  // File symlinks require a Windows privilege; do not change it for unit tests.
  if (process.platform !== 'win32') {
    await symlink('../invalid.tar.gz', join(staging, 'link'));
    assert.notEqual(
      spawnSync(python, [archiveScript, staging, output]).status,
      0,
    );
    await assert.rejects(readFile(output), /ENOENT/);
  }
});

test('release requires an explicit main dispatch and the reviewed exact version/head/tag', () => {
  const sha = 'a'.repeat(40);
  const valid = {
    version: '0.17.5',
    inputVersion: '0.17.5',
    head: sha,
    expectedHead: sha,
    main: sha,
    tag: sha,
    event: 'workflow_dispatch',
    ref: 'refs/heads/main',
  };
  assert.doesNotThrow(() => validateReleaseIdentity(valid));
  for (const change of [
    { inputVersion: '0.17.4' },
    { expectedHead: sha.slice(0, 8) },
    { main: 'b'.repeat(40) },
    { tag: 'c'.repeat(40) },
    { head: 'd'.repeat(40) },
    { event: 'push' },
    { ref: 'refs/heads/develop' },
    { version: '0.17.5;echo injection' },
  ])
    assert.throws(() => validateReleaseIdentity({ ...valid, ...change }));
});

test('Mac payload rejects altered ASAR bytes, unexpected models and changed notices', async (t) => {
  const { createPackage } = await import('@electron/asar');
  const { verifyMacPayload } = await import('../macos/payload.mjs');
  const root = await fresh(t);
  let index = 0;
  for (const scenario of ['altered-build', 'gguf', 'notice']) {
    const directory = join(root, String(index++));
    const project = join(directory, 'source'),
      staging = join(directory, 'asar'),
      app = join(directory, 'App.app');
    const resources = join(app, 'Contents/Resources');
    await mkdir(resources, { recursive: true });
    for (const name of [
      'package.json',
      'build/main.js',
      'build/pitch-vision/efficientdet-lite2.tflite',
      'build/electron/src/pitch-vision/efficientdet-lite2.tflite',
    ]) {
      const bytes =
        name === 'package.json'
          ? JSON.stringify({
              name: 'fixture',
              version: '1.2.3',
              main: 'build/main.js',
            })
          : 'fixture';
      for (const base of [project, staging]) {
        const { dirname } = await import('node:path');
        await mkdir(dirname(join(base, name)), { recursive: true });
        await writeFile(join(base, name), bytes);
      }
    }
    if (scenario === 'altered-build')
      await writeFile(join(staging, 'build/main.js'), 'changed');
    if (scenario === 'gguf')
      for (const base of [project, staging])
        await writeFile(join(base, 'build/private.gguf'), 'excluded fixture');
    if (scenario === 'notice') {
      await writeFile(join(project, 'LICENSE'), 'source notice');
      await writeFile(join(resources, 'LICENSE'), 'different notice');
    }
    await createPackage(staging, join(resources, 'app.asar'));
    await assert.rejects(
      verifyMacPayload({ project, app, arch: 'arm64' }),
      scenario === 'altered-build'
        ? /byte mismatch: build\/main.js/
        : scenario === 'gguf'
          ? /models found/
          : /byte mismatch: LICENSE/,
    );
  }
});
