import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { createPackage, uncacheAll } from '@electron/asar';
import { verifyInstalledDistribution } from '../windows/installed-distribution.mjs';
import { SOURCES } from '../media-tools/sources.mjs';
import { TOOLCHAIN_NOTICES } from '../media-tools/toolchain-notices.mjs';

const hash = (data) => createHash('sha256').update(data).digest('hex');
const put = async (root, name, data) => {
  const path = join(root, name);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, data);
};
const json = (data) => JSON.stringify(data, null, 2);
const fixture = async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'distribution-fixture-'));
  t.after(async () => {
    uncacheAll();
    await rm(root, { recursive: true, force: true });
  });
  const project = join(root, 'source'),
    installation = join(root, 'installed'),
    packed = join(root, 'packed');
  const resources = join(installation, 'resources'),
    installer = join(root, 'synthetic-installer.exe');
  const signatureInputs = [
    ['installer', installer],
    ['application', join(installation, 'SporTagLytics.exe')],
    ['ffmpeg', join(resources, 'media-tools/ffmpeg.exe')],
    ['ffprobe', join(resources, 'media-tools/ffprobe.exe')],
  ];
  const signatures = [];
  for (const [role, path] of signatureInputs) {
    await mkdir(dirname(path), { recursive: true });
    const bytes = Buffer.from(`Synthetic non-executable ${role}`);
    await writeFile(path, bytes);
    signatures.push({ role, status: 'NotSigned', sha256: hash(bytes) });
  }
  for (const name of ['LICENSE', 'THIRD_PARTY_NOTICES.md']) {
    await put(project, name, `Synthetic ${name}\r\n`);
    await put(resources, name, `Synthetic ${name}\r\n`);
  }
  await put(project, 'package.json', json({ version: '0.0.0' }));
  await put(packed, 'package.json', json({ version: '0.0.0' }));
  for (const [name, source] of [
    ['licenses/renderer.json', 'build/licenses/renderer.json'],
    ['licenses/preload.json', 'build/electron/src/licenses/preload.json'],
  ]) {
    const bytes = json([
      { name: 'synthetic-package', version: '1.0.0', notices: [] },
    ]);
    await put(project, source, bytes);
    await put(resources, name, bytes);
    await put(packed, source, bytes);
  }
  const icon = Buffer.from('Synthetic icon'),
    model = Buffer.from('Synthetic model');
  await put(
    project,
    'docs/asset-inventory.json',
    json({
      files: [
        { path: 'public/icon.png', bytes: icon.length, sha256: hash(icon) },
      ],
    }),
  );
  await put(project, 'public/icon.png', icon);
  await put(packed, 'build/icon.png', icon);
  await put(
    project,
    'resources/pitch-vision/NOTICE.md',
    `Synthetic\r\nSHA-256: ${hash(model)}\r\n`,
  );
  await put(project, 'resources/pitch-vision/LICENSE.txt', 'Synthetic license');
  await put(
    packed,
    'build/pitch-vision/licenses/NOTICE.md',
    `Synthetic\r\nSHA-256: ${hash(model)}\r\n`,
  );
  await put(
    packed,
    'build/pitch-vision/licenses/LICENSE.txt',
    'Synthetic license',
  );
  await put(project, 'public/pitch-vision/efficientdet-lite2.tflite', model);
  await put(packed, 'build/pitch-vision/efficientdet-lite2.tflite', model);
  await put(
    project,
    'node_modules/@mediapipe/tasks-vision/wasm/vision.wasm',
    'Synthetic WASM',
  );
  await put(packed, 'build/pitch-vision/wasm/vision.wasm', 'Synthetic WASM');
  const toolchain = {
    schemaVersion: 1,
    compilerVersion: '16.2.0',
    packages: Object.fromEntries(
      Object.keys(TOOLCHAIN_NOTICES).map((name) => [name, '16.2.0-1']),
    ),
    files: {},
  };
  for (const [pkg, names] of Object.entries(TOOLCHAIN_NOTICES))
    for (const name of names) {
      const path = `${pkg}/${name}`,
        bytes = `Synthetic ${path}`;
      toolchain.files[path] = hash(bytes);
      await put(resources, `media-tools/licenses/toolchain/${path}`, bytes);
      await put(
        project,
        `.cache/media-tools/win32-x64/licenses/toolchain/${path}`,
        bytes,
      );
    }
  await put(
    resources,
    'media-tools/licenses/toolchain/manifest.json',
    json(toolchain),
  );
  await put(
    project,
    '.cache/media-tools/win32-x64/licenses/toolchain/manifest.json',
    json(toolchain),
  );
  const manifest = {
    identity: {
      revision: 1,
      platform: 'win32',
      architecture: 'x64',
      sources: Object.fromEntries(
        Object.entries(SOURCES).map(([name, source]) => [
          name,
          { version: source.version, sha256: source.sha256 },
        ]),
      ),
    },
    binaries: Object.fromEntries(
      signatures
        .filter((s) => s.role.startsWith('ff'))
        .map((s) => [s.role, s.sha256]),
    ),
    toolchain,
  };
  await put(resources, 'media-tools/build.json', json(manifest));
  await put(project, '.cache/media-tools/win32-x64/build.json', json(manifest));
  const pack = async () => {
    uncacheAll();
    await createPackage(packed, join(resources, 'app.asar'));
  };
  await pack();
  return {
    project,
    installation,
    installer,
    signatures,
    resources,
    packed,
    pack,
  };
};

test('reports installed byte identities with CRLF notices, and no private paths or certificate fields', async (t) => {
  const data = await fixture(t);
  data.signatures[0].privatePath = '/private/not-for-report';
  data.signatures[0].signerSubject = 'not-for-report';
  const report = await verifyInstalledDistribution(data);
  assert.equal(report.assetInventory.packagedFiles, 1);
  assert.equal(report.toolchain.noticeFiles, 13);
  assert.equal(report.models.ggufFiles, 0);
  assert.equal(report.binaries[0].signatureStatus, 'NotSigned');
  assert.ok(!json(report).includes('not-for-report'));
  assert.ok(!json(report).includes(data.project));
  assert.ok(
    report.files.some((f) => f.path === 'resources/THIRD_PARTY_NOTICES.md'),
  );
});

for (const [name, mutate] of [
  [
    'NOTICE bytes',
    (d) => put(d.resources, 'THIRD_PARTY_NOTICES.md', 'changed'),
  ],
  [
    'external inventory',
    (d) => put(d.resources, 'licenses/renderer.json', '[]'),
  ],
  [
    'archived inventory',
    async (d) => {
      await put(d.packed, 'build/licenses/renderer.json', '[]');
      await d.pack();
    },
  ],
  [
    'pinned model',
    async (d) => {
      await put(
        d.packed,
        'build/pitch-vision/efficientdet-lite2.tflite',
        'changed',
      );
      await d.pack();
    },
  ],
  [
    'WASM bytes',
    async (d) => {
      await put(d.packed, 'build/pitch-vision/wasm/vision.wasm', 'changed');
      await d.pack();
    },
  ],
  [
    'missing packaged icon',
    async (d) => {
      await rm(join(d.packed, 'build/icon.png'));
      await d.pack();
    },
  ],
  [
    'empty WASM distribution',
    (d) =>
      rm(
        join(
          d.project,
          'node_modules/@mediapipe/tasks-vision/wasm/vision.wasm',
        ),
      ),
  ],
  [
    'compiler notice hash',
    (d) =>
      put(
        d.resources,
        'media-tools/licenses/toolchain/libgcc/COPYING3',
        'changed',
      ),
  ],
  [
    'unexpected GGUF in ASAR',
    async (d) => {
      await put(d.packed, 'build/unexpected.GGUF', 'weights');
      await d.pack();
    },
  ],
  [
    'unexpected GGUF in resources',
    (d) => put(d.resources, 'llama/extra.gguf', 'weights'),
  ],
  [
    'event pack',
    (d) => put(d.resources, 'event-detection-models/pack/model.bin', 'weights'),
  ],
  [
    'event pack in ASAR',
    async (d) => {
      await put(
        d.packed,
        'build/event-detection-models/pack/model.bin',
        'weights',
      );
      await d.pack();
    },
  ],
  [
    'inventory traversal',
    (d) =>
      put(
        d.project,
        'docs/asset-inventory.json',
        json({ files: [{ path: '../private.txt' }] }),
      ),
  ],
  [
    'signature invalid',
    async (d) => {
      d.signatures[0].status = 'HashMismatch';
    },
  ],
  [
    'signature report detached from binary',
    async (d) => {
      d.signatures[0].sha256 = '0'.repeat(64);
    },
  ],
  [
    'missing signature record',
    async (d) => {
      d.signatures.pop();
    },
  ],
  [
    'unsigned native binary changed after build',
    async (d) => {
      const bytes = Buffer.from('changed binary');
      await put(d.resources, 'media-tools/ffmpeg.exe', bytes);
      d.signatures.find((s) => s.role === 'ffmpeg').sha256 = hash(bytes);
    },
  ],
])
  test(`rejects ${name}`, async (t) => {
    const data = await fixture(t);
    await mutate(data);
    await assert.rejects(verifyInstalledDistribution(data));
  });

test('keeps signed native hashes separate from the pre-signing build identity', async (t) => {
  const data = await fixture(t);
  const bytes = Buffer.concat([
    await readFile(join(data.resources, 'media-tools/ffmpeg.exe')),
    Buffer.from('synthetic signing bytes'),
  ]);
  await put(data.resources, 'media-tools/ffmpeg.exe', bytes);
  Object.assign(
    data.signatures.find((s) => s.role === 'ffmpeg'),
    { status: 'Valid', sha256: hash(bytes) },
  );
  const report = await verifyInstalledDistribution(data);
  const binary = report.binaries.find((b) => b.role === 'ffmpeg');
  assert.equal(binary.matchesBuildBytes, false);
  assert.equal(binary.signatureStatus, 'Valid');
  assert.notEqual(binary.sha256, binary.preSigningBuildSha256);
});
