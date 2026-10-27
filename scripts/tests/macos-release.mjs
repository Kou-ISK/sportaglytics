import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
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
import { desktopReleaseNotes } from '../desktop-release-notes.mjs';
import { releaseVerificationSummary } from '../release-verification-summary.mjs';

const summaryFixture = (includeWindows = false) => {
  const version = '1.2.3',
    head = 'a'.repeat(40),
    tree = 'b'.repeat(40);
  const assets = {
    'SporTagLytics-1.2.3-arm64.dmg': 'c'.repeat(64),
    'SporTagLytics-1.2.3-x64.dmg': 'd'.repeat(64),
    'media-tools-sources-1.2.3-macos.tar.gz': 'e'.repeat(64),
  };
  const macReports = Object.fromEntries(
    ['arm64', 'x64'].map((arch) => [
      arch,
      {
        schemaVersion: 1,
        head,
        version,
        arch,
        dmgSha256: assets[`SporTagLytics-${version}-${arch}.dmg`],
        appTreeSha256: 'f'.repeat(64),
        developerIdNativeFiles: 10,
        notarized: true,
        stapled: true,
        gatekeeperAccepted: true,
        payload: { arch, passed: true, privateDiagnostic: 'must not publish' },
        diagnosticPath: '/synthetic/runner/private-path',
      },
    ]),
  );
  const windows = includeWindows
    ? {
        version,
        sourceCommit: head,
        sourceTree: tree,
        installerSha256: '1'.repeat(64),
        installerSignatureStatus: 'NotSigned',
        mediaManifestSha256: '2'.repeat(64),
        pitchModelSha256: '3'.repeat(64),
        rawLog: 'must not publish',
      }
    : undefined;
  if (includeWindows) {
    assets['SporTagLytics-Setup-1.2.3-x64.exe'] = windows.installerSha256;
    assets['media-tools-sources-1.2.3-windows.tar.gz'] = '4'.repeat(64);
  }
  return {
    version,
    head,
    tree,
    runId: '12345',
    repository: 'fixture/project',
    macReports,
    windows,
    assets,
  };
};

test('release summary retains public identity while excluding raw diagnostics', () => {
  for (const includeWindows of [false, true]) {
    const input = summaryFixture(includeWindows);
    const summary = releaseVerificationSummary(input);
    assert.equal(summary.sourceCommit, input.head);
    assert.equal(
      summary.workflowRun,
      'https://github.com/fixture/project/actions/runs/12345',
    );
    assert.equal(summary.macos.length, 2);
    assert.equal(Boolean(summary.windows), includeWindows);
    if (includeWindows)
      assert.equal(summary.windows.installerSignatureStatus, 'NotSigned');
    assert.doesNotMatch(
      JSON.stringify(summary),
      /must not publish|private-path|rawLog/,
    );
    assert.match(summary.evidenceScope, /Not an independent attestation/);
  }
});

test('release summary rejects mismatched or incomplete macOS verification', () => {
  for (const change of [
    { head: '9'.repeat(40) },
    { arch: 'x64' },
    { version: '1.2.2' },
    { dmgSha256: '0'.repeat(64) },
    { notarized: false },
    { stapled: false },
    { gatekeeperAccepted: false },
    { payload: { passed: false } },
    { developerIdNativeFiles: 0 },
    { appTreeSha256: 'invalid' },
  ]) {
    const input = summaryFixture();
    Object.assign(input.macReports.arm64, change);
    assert.throws(() => releaseVerificationSummary(input));
  }
});

test('release summary rejects wrong Windows source, bytes or signature state', () => {
  for (const change of [
    { sourceCommit: '0'.repeat(40) },
    { sourceTree: '0'.repeat(40) },
    { version: '1.2.2' },
    { installerSha256: '0'.repeat(64) },
    { installerSignatureStatus: 'UnknownError' },
    { mediaManifestSha256: '' },
  ]) {
    const input = summaryFixture(true);
    Object.assign(input.windows, change);
    assert.throws(() => releaseVerificationSummary(input));
  }
});

test('release summary rejects extra, missing, unhashed assets and unsafe workflow identifiers', () => {
  for (const mutate of [
    (input) => {
      input.assets['private.txt'] = '5'.repeat(64);
    },
    (input) => {
      delete input.assets['media-tools-sources-1.2.3-macos.tar.gz'];
    },
    (input) => {
      input.assets['SporTagLytics-1.2.3-arm64.dmg'] = '';
    },
    (input) => {
      input.runId = '../foreign';
    },
    (input) => {
      input.repository = 'https://example.invalid';
    },
  ]) {
    const input = summaryFixture();
    mutate(input);
    assert.throws(() => releaseVerificationSummary(input));
  }
});

const python = process.platform === 'win32' ? 'python' : 'python3';
const archiveScript = resolve('scripts/media-tools/archive-sources.py');
const packageScript = resolve('scripts/package-media-sources.mjs');
const fresh = async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'sportaglytics-release-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
};

test('desktop release notes distinguish unsigned installers, valid signatures and Mac-only releases', () => {
  const mac = desktopReleaseNotes({ includeWindows: false });
  assert.match(mac, /DMG内のアプリは署名・公証済み/);
  assert.match(mac, /Windows installerはこのReleaseに含みません。/);
  assert.doesNotMatch(mac, /Windows installerは未署名|Windows x64/);
  for (const [status, expected, excluded] of [
    [
      'NotSigned',
      'Windows installerは未署名です。',
      'Authenticode署名を検証済み',
    ],
    [
      'Valid',
      'Windows installerのAuthenticode署名を検証済みです。',
      'installerは未署名',
    ],
  ]) {
    const notes = desktopReleaseNotes({
      includeWindows: true,
      installerSignatureStatus: status,
    });
    assert.ok(notes.includes(expected));
    assert.ok(!notes.includes(excluded));
    assert.match(notes, /インストール後の全E2Eと同梱物を検査済み/);
    assert.doesNotMatch(notes, /\d+\s*E2E|\uFFFD/);
    assert.match(notes, /Windows Nと実カメラは未検証/);
  }
});

test('desktop release notes reject absent or unverified Windows signature states', () => {
  for (const status of [
    undefined,
    null,
    '',
    'HashMismatch',
    'NotTrusted',
    'UnknownError',
    'NotSigned。',
  ])
    assert.throws(
      () =>
        desktopReleaseNotes({
          includeWindows: true,
          installerSignatureStatus: status,
        }),
      /Unsupported Windows installer signature status/,
    );
});

test('release notes CLI writes UTF-8 independently of the shell locale and needs no Windows evidence for Mac-only', async (t) => {
  const script = resolve('scripts/desktop-release-notes.mjs');
  for (const locale of ['C', 'en_US', 'en_US.UTF-8']) {
    for (const includeWindows of [false, true]) {
      const root = await fresh(t);
      if (includeWindows) {
        await mkdir(join(root, 'dist'));
        await writeFile(
          join(root, 'dist/windows-release.json'),
          JSON.stringify({ installerSignatureStatus: 'NotSigned' }),
        );
      }
      const result = spawnSync(process.execPath, [script], {
        cwd: root,
        env: {
          ...process.env,
          INCLUDE_WINDOWS: String(includeWindows),
          LC_ALL: locale,
          LANG: locale,
        },
        encoding: 'utf8',
      });
      assert.equal(result.status, 0, result.stderr);
      const bytes = await readFile(join(root, 'dist/release-notes.md'));
      const notes = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      assert.ok(
        notes.includes(
          includeWindows
            ? 'Windows installerは未署名です。Windows N'
            : 'Windows installerはこのReleaseに含みません。',
        ),
      );
      assert.doesNotMatch(notes, /\uFFFD|\d+\s*E2E/);
      assert.ok(
        bytes.includes(
          Buffer.from('GGUFと自動検出用model packは別途必要です。', 'utf8'),
        ),
      );
    }
  }
});

test('release notes CLI fails before producing a publishable file when its evidence or selection is invalid', async (t) => {
  for (const [selection, evidence] of [
    ['true', undefined],
    ['true', { installerSignatureStatus: 'HashMismatch' }],
    ['true', {}],
    ['yes', { installerSignatureStatus: 'NotSigned' }],
  ]) {
    const root = await fresh(t);
    if (evidence !== undefined) {
      await mkdir(join(root, 'dist'));
      await writeFile(
        join(root, 'dist/windows-release.json'),
        JSON.stringify(evidence),
      );
    }
    const result = spawnSync(
      process.execPath,
      [resolve('scripts/desktop-release-notes.mjs')],
      {
        cwd: root,
        env: { ...process.env, INCLUDE_WINDOWS: selection },
        encoding: 'utf8',
      },
    );
    assert.notEqual(result.status, 0);
    await assert.rejects(
      readFile(join(root, 'dist/release-notes.md')),
      /ENOENT/,
    );
  }
});

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
  assert.deepEqual(Object.keys(sourcesForTargets(['win32-x64'])).sort(), [
    'ffmpeg',
    'freetype',
    'harfbuzz',
    'zlib',
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
  for (const scenario of [
    'altered-build',
    'gguf',
    'notice',
    'missing-native',
  ]) {
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
      // Shared payload checks use the Intel fixture; arm64 additionally requires native resources.
      verifyMacPayload({
        project,
        app,
        arch: scenario === 'missing-native' ? 'arm64' : 'x64',
      }),
      scenario === 'missing-native'
        ? /Native standard package resource set/
        : scenario === 'altered-build'
          ? /byte mismatch: build\/main.js/
          : scenario === 'gguf'
            ? /models found/
            : /byte mismatch: LICENSE/,
    );
  }
});

test('summary CLI hashes actual candidate bytes and refuses to overwrite its evidence', async (t) => {
  const root = await fresh(t);
  const git = (...args) =>
    execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  git('init', '--quiet');
  git(
    '-c',
    'user.name=Synthetic Test',
    '-c',
    'user.email=synthetic@example.invalid',
    'commit',
    '--allow-empty',
    '-m',
    'fixture',
    '--quiet',
  );
  const input = summaryFixture();
  input.head = git('rev-parse', 'HEAD');
  await mkdir(join(root, 'dist/mac-verification'), { recursive: true });
  await writeFile(
    join(root, 'package.json'),
    JSON.stringify({ version: input.version }),
  );
  for (const name of Object.keys(input.assets)) {
    const bytes = Buffer.from(`synthetic release asset: ${name}`);
    input.assets[name] = createHash('sha256').update(bytes).digest('hex');
    await writeFile(join(root, 'dist', name), bytes);
  }
  for (const arch of ['arm64', 'x64']) {
    Object.assign(input.macReports[arch], {
      head: input.head,
      dmgSha256: input.assets[`SporTagLytics-${input.version}-${arch}.dmg`],
    });
    await writeFile(
      join(root, 'dist/mac-verification', `final-${arch}.json`),
      JSON.stringify(input.macReports[arch]),
    );
  }
  const run = () =>
    spawnSync(
      process.execPath,
      [resolve('scripts/release-verification-summary.mjs')],
      {
        cwd: root,
        encoding: 'utf8',
        env: {
          ...process.env,
          INCLUDE_WINDOWS: 'false',
          EXPECTED_SHA: input.head,
          GITHUB_SHA: input.head,
          GITHUB_RUN_ID: input.runId,
          GITHUB_REPOSITORY: input.repository,
        },
      },
    );
  const first = run();
  assert.equal(first.status, 0, first.stderr);
  const path = join(root, 'dist/release-verification.json');
  const bytes = await readFile(path);
  assert.deepEqual(JSON.parse(bytes).assets, input.assets);
  assert.equal(JSON.parse(bytes).sourceTree, git('rev-parse', 'HEAD^{tree}'));
  assert.notEqual(run().status, 0);
  assert.deepEqual(await readFile(path), bytes);
  await rm(path);
  await writeFile(
    join(root, 'dist/SporTagLytics-1.2.3-arm64.dmg'),
    'modified candidate',
  );
  assert.notEqual(run().status, 0);
  await assert.rejects(readFile(path), /ENOENT/);
});
