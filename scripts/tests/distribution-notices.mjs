import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { licenseInventory } from '../license-inventory.mjs';
import { validateBuildManifest } from '../media-tools/source-manifest.mjs';
import { SOURCES } from '../media-tools/sources.mjs';

test('rendered dependencies retain full license and NOTICE; unused packages stay out', async () => {
  const root = await mkdtemp(join(tmpdir(), 'notice-test-'));
  try {
    const used = join(root, 'node_modules', 'used');
    const unused = join(root, 'node_modules', 'unused');
    for (const dir of [used, unused]) {
      await mkdir(dir, { recursive: true });
      await writeFile(
        join(dir, 'package.json'),
        JSON.stringify({
          name: dir === used ? 'used' : 'unused',
          version: '1.0.0',
          license: 'MIT',
        }),
      );
      await writeFile(
        join(dir, 'LICENSE'),
        'Full copyright and permission text',
      );
      await writeFile(join(dir, 'NOTICE'), 'Additional upstream attribution');
    }
    let artifact;
    const emit = {
      emitFile: (file) => {
        artifact = file;
      },
    };
    const bundle = {
      app: {
        type: 'chunk',
        moduleIds: [join(used, 'index.js'), join(used, 'other.js')],
      },
    };
    await licenseInventory().generateBundle.call(emit, {}, bundle);
    const inventory = JSON.parse(artifact.source);
    assert.deepEqual(
      inventory.map(({ name }) => name),
      ['used'],
    );
    assert.equal(inventory[0].notices.length, 2);
    assert.ok(
      inventory[0].notices.some(
        ({ text }) => text === 'Additional upstream attribution',
      ),
    );
    await rm(join(used, 'LICENSE'));
    await assert.rejects(
      licenseInventory().generateBundle.call(emit, {}, bundle),
      /Missing license text/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('source release rejects mismatched, incomplete, or wrong-target build evidence', () => {
  const manifest = {
    identity: {
      platform: 'win32',
      architecture: 'x64',
      revision: 6,
      sources: Object.fromEntries(
        Object.entries(SOURCES).map(([name, value]) => [
          name,
          { version: value.version, sha256: value.sha256 },
        ]),
      ),
    },
    binaries: { ffmpeg: 'a'.repeat(64), ffprobe: 'b'.repeat(64) },
    localDiagnostic: '/private/example',
  };
  assert.equal(
    validateBuildManifest(manifest, 'win32-x64').localDiagnostic,
    undefined,
  );
  assert.throws(
    () => validateBuildManifest(manifest, 'darwin-x64'),
    /target mismatch/,
  );
  const changed = structuredClone(manifest);
  changed.identity.sources.ffmpeg.sha256 = '0'.repeat(64);
  assert.throws(
    () => validateBuildManifest(changed, 'win32-x64'),
    /Source identity mismatch/,
  );
  delete changed.identity.sources.ffmpeg;
  assert.throws(
    () => validateBuildManifest(changed, 'win32-x64'),
    /Incomplete source identity/,
  );
});

test('packaging fails when a generated notice is omitted from resources', async () => {
  const { default: afterPack } = await import('../after-pack.mjs');
  const root = await mkdtemp(join(tmpdir(), 'pack-notice-test-'));
  const context = {
    appOutDir: root,
    electronPlatformName: 'linux',
    packager: { getResourcesDir: () => root },
  };
  try {
    await assert.rejects(afterPack(context), /ENOENT/);
    await mkdir(join(root, 'licenses'));
    await writeFile(join(root, 'LICENSE'), 'App MIT text');
    await writeFile(
      join(root, 'THIRD_PARTY_NOTICES.md'),
      'Third-party inventory',
    );
    await writeFile(
      join(root, 'licenses/renderer.json'),
      JSON.stringify([{ name: 'fixture' }]),
    );
    await writeFile(join(root, 'licenses/preload.json'), '[]');
    await afterPack(context);
    await rm(join(root, 'licenses/renderer.json'));
    await assert.rejects(afterPack(context), /ENOENT/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('source mirrors reject wrong bytes, accept the pinned archive and reuse it offline', async () => {
  const { createServer } = await import('node:http');
  const { createHash } = await import('node:crypto');
  const { readFile } = await import('node:fs/promises');
  const { downloadSourceArchive } =
    await import('../media-tools/source-download.mjs');
  const bytes = Buffer.from('synthetic public source archive');
  const root = await mkdtemp(join(tmpdir(), 'source-mirror-test-'));
  let requests = 0;
  const server = createServer((request, response) => {
    requests += 1;
    response.end(
      request.url === '/archive' ? bytes : '<html>not an archive</html>',
    );
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const source = {
    directory: 'fixture',
    url: `${base}/bad`,
    mirrors: [`${base}/archive`],
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
  try {
    const file = join(root, 'source.tar');
    await writeFile(file, 'incomplete old cache');
    await downloadSourceArchive(source, file);
    assert.deepEqual(await readFile(file), bytes);
    assert.equal(requests, 2);
    await downloadSourceArchive(source, file);
    assert.equal(requests, 2);
    await assert.rejects(
      downloadSourceArchive({ ...source, mirrors: [] }, join(root, 'bad.tar')),
      /Checksum mismatch/,
    );
    await assert.rejects(readFile(join(root, 'bad.tar')), /ENOENT/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(root, { recursive: true, force: true });
  }
});
