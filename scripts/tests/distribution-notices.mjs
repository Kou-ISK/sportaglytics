import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { licenseInventory } from '../license-inventory.mjs';
import { validateBuildManifest } from '../media-tools/source-manifest.mjs';
import { SOURCES } from '../media-tools/sources.mjs';
import {
  TOOLCHAIN_NOTICES,
  copyWindowsToolchainNotices,
  validateToolchainRecord,
  verifyWindowsToolchainNotices,
} from '../media-tools/toolchain-notices.mjs';

import {
  copyMacLlamaNotices,
  MAC_LLAMA_NOTICE_HASHES,
  verifyMacLlamaNotices,
} from '../mac-llama-notices.mjs';

test('Windows Git checkout preserves exact upstream license bytes', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'notice-checkout-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const relative = 'resources/third-party/llama-b7849';
  await mkdir(join(root, relative), { recursive: true });
  await writeFile(
    join(root, '.gitattributes'),
    await readFile(new URL('../../.gitattributes', import.meta.url)),
  );
  await writeFile(join(root, 'control.txt'), 'ordinary text\n');
  for (const name of Object.keys(MAC_LLAMA_NOTICE_HASHES))
    await writeFile(
      join(root, relative, name),
      await readFile(new URL(`../../${relative}/${name}`, import.meta.url)),
    );
  const git = (args) => execFileSync('git', args, { cwd: root, stdio: 'pipe' });
  git(['init', '--quiet']);
  git(['-c', 'core.autocrlf=false', 'add', '.']);
  const checkout = `${join(root, 'checkout').replaceAll('\\', '/')}/`;
  git([
    '-c',
    'core.autocrlf=true',
    'checkout-index',
    '--all',
    '--force',
    `--prefix=${checkout}`,
  ]);
  // A control proves this checkout exercises CRLF conversion on every test OS.
  assert.equal(
    await readFile(join(checkout, 'control.txt'), 'utf8'),
    'ordinary text\r\n',
  );
  for (const [name, expected] of Object.entries(MAC_LLAMA_NOTICE_HASHES)) {
    const bytes = await readFile(join(checkout, relative, name));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), expected);
    assert.ok(!bytes.includes(Buffer.from('\r\n')));
  }
});

const macLlamaFixture = async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'mac-llama-notices-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const texts = await Promise.all(
    ['LICENSE-jsonhpp', 'LICENSE-cpp-httplib', 'LICENSE-BoringSSL'].map(
      (name) =>
        readFile(
          new URL(
            `../../resources/third-party/llama-b7849/${name}`,
            import.meta.url,
          ),
        ),
    ),
  );
  // Synthetic, non-executable fixture; no upstream runtime or model is run.
  await writeFile(join(directory, 'llama-completion'), Buffer.concat(texts));
  return directory;
};

test('macOS runtime gets the three exact reviewed dependency notices', async (t) => {
  const directory = await macLlamaFixture(t);
  const hashes = await copyMacLlamaNotices(directory, 'b7849');
  assert.deepEqual(Object.keys(hashes).sort(), [
    'licenses/LICENSE-BoringSSL',
    'licenses/LICENSE-cpp-httplib',
    'licenses/LICENSE-jsonhpp',
  ]);
  await verifyMacLlamaNotices(directory, 'b7849');
});

test('missing or changed cached/packaged notices and unbound binary fail closed', async (t) => {
  const directory = await macLlamaFixture(t);
  await copyMacLlamaNotices(directory, 'b7849');
  const notice = join(directory, 'licenses/LICENSE-jsonhpp');
  await rm(notice);
  await assert.rejects(verifyMacLlamaNotices(directory, 'b7849'), /ENOENT/);
  await writeFile(notice, 'MIT label without the full notice');
  await assert.rejects(
    verifyMacLlamaNotices(directory, 'b7849'),
    /Invalid.*notice/,
  );
  await copyMacLlamaNotices(directory, 'b7849');
  await writeFile(join(directory, 'llama-completion'), 'different runtime');
  await assert.rejects(
    verifyMacLlamaNotices(directory, 'b7849'),
    /does not embed/,
  );
  await assert.rejects(
    copyMacLlamaNotices(directory, 'b7849'),
    /does not embed/,
  );
});

test('a different llama version requires a new notice review', async (t) => {
  const directory = await macLlamaFixture(t);
  await assert.rejects(
    copyMacLlamaNotices(directory, 'b7850'),
    /Review.*version/,
  );
});

const toolchainFixtureRecord = () => ({
  schemaVersion: 1,
  compilerVersion: '16.2.0',
  packages: Object.fromEntries(
    Object.keys(TOOLCHAIN_NOTICES).map((name) => [
      name,
      ['libgcc', 'libstdc++'].includes(name)
        ? '16.2.0-4'
        : '14.0.0.r426.g4564ee4b5-1',
    ]),
  ),
  files: Object.fromEntries(
    Object.entries(TOOLCHAIN_NOTICES).flatMap(([pkg, files]) =>
      files.map((name) => [`${pkg}/${name}`, 'c'.repeat(64)]),
    ),
  ),
});

const installedToolchainFixture = async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'toolchain-notices-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const licenses = join(root, 'installed-licenses');
  const record = toolchainFixtureRecord();
  for (const [pkg, files] of Object.entries(TOOLCHAIN_NOTICES)) {
    await mkdir(join(licenses, pkg), { recursive: true });
    for (const file of files)
      await writeFile(
        join(licenses, pkg, file),
        `Synthetic notice for ${pkg}/${file}\n`,
      );
  }
  const capture = async (command, args) => {
    if (command === 'gcc' && args.join(' ') === '-dumpfullversion')
      return '16.2.0';
    if (command === 'cygpath' && args.join(' ') === '-w /ucrt64/share/licenses')
      return licenses;
    const name = args[1]?.replace('mingw-w64-ucrt-x86_64-', '');
    assert.equal(command, 'pacman');
    assert.equal(args[0], '-Q');
    assert.ok(record.packages[name]);
    return `${args[1]} ${record.packages[name]}`;
  };
  const output = join(root, 'media-tools');
  return { output, licenses, capture };
};

test('Windows notices retain installed package bytes and match the binary build record', async (t) => {
  const { output, licenses, capture } = await installedToolchainFixture(t);
  const record = await copyWindowsToolchainNotices(output, { capture });
  assert.equal(Object.keys(record.packages).length, 6);
  assert.equal(Object.keys(record.files).length, 13);
  for (const path of Object.keys(record.files))
    assert.deepEqual(
      await readFile(join(output, 'licenses/toolchain', path)),
      await readFile(join(licenses, path)),
    );
  await writeFile(
    join(output, 'build.json'),
    JSON.stringify({ toolchain: record }),
  );
  assert.deepEqual(await verifyWindowsToolchainNotices(output), record);
  await assert.rejects(
    verifyWindowsToolchainNotices(output, toolchainFixtureRecord()),
    /binary build record/,
  );
  await writeFile(
    join(output, 'licenses/toolchain/libgcc/COPYING.RUNTIME'),
    'changed',
  );
  await assert.rejects(
    verifyWindowsToolchainNotices(output),
    /Changed.*notice/,
  );
  await rm(join(output, 'licenses/toolchain/libgcc/COPYING.RUNTIME'));
  await assert.rejects(verifyWindowsToolchainNotices(output), /ENOENT/);
});

test('Windows notice capture rejects missing or empty installed files and malformed package identity', async (t) => {
  const { output, licenses, capture } = await installedToolchainFixture(t);
  await writeFile(join(licenses, 'libgcc/COPYING.RUNTIME'), ' \n');
  await assert.rejects(
    copyWindowsToolchainNotices(output, { capture }),
    /Empty toolchain notice/,
  );
  await rm(join(licenses, 'libgcc/COPYING.RUNTIME'));
  await assert.rejects(
    copyWindowsToolchainNotices(output, { capture }),
    /ENOENT/,
  );
  await assert.rejects(
    copyWindowsToolchainNotices(output, {
      capture: async (command, args) =>
        command === 'pacman'
          ? 'unexpected-package 1.0'
          : capture(command, args),
    }),
    /Cannot identify/,
  );
});

test('source evidence rejects incomplete toolchains and exports only defined metadata', () => {
  const record = toolchainFixtureRecord();
  const sanitized = validateToolchainRecord({
    ...record,
    localPath: '/private/example',
    diagnostic: 'not for publication',
  });
  assert.deepEqual(sanitized, record);
  assert.throws(() => validateToolchainRecord(undefined), /Incomplete/);
  const missing = structuredClone(record);
  delete missing.files['libgcc/COPYING.RUNTIME'];
  assert.throws(() => validateToolchainRecord(missing), /Incomplete/);
  const changed = structuredClone(record);
  changed.packages.libgcc = '15.2.0-1';
  assert.throws(() => validateToolchainRecord(changed), /versions disagree/);
});

test('Windows packaging requires intact compiler notices matching build.json', async (t) => {
  const { default: afterPack } = await import('../after-pack.mjs');
  const { output, capture } = await installedToolchainFixture(t);
  const resources = join(output, '..');
  await mkdir(join(resources, 'licenses'), { recursive: true });
  for (const [file, text] of Object.entries({
    LICENSE: 'Synthetic app license',
    'THIRD_PARTY_NOTICES.md': 'Synthetic inventory',
    'licenses/renderer.json': '[{"name":"fixture"}]',
    'licenses/preload.json': '[]',
  }))
    await writeFile(join(resources, file), text);
  await mkdir(join(output, 'licenses'), { recursive: true });
  for (const file of [
    'ffmpeg-COPYING.LGPLv2.1',
    'freetype-LICENSE.TXT',
    'freetype-FTL.TXT',
    'harfbuzz-COPYING',
    'zlib-LICENSE',
  ])
    await writeFile(join(output, 'licenses', file), 'Synthetic media notice');
  const context = {
    appOutDir: resources,
    electronPlatformName: 'win32',
    packager: { getResourcesDir: () => resources },
  };
  await assert.rejects(afterPack(context), /ENOENT/);
  const record = await copyWindowsToolchainNotices(output, { capture });
  await writeFile(
    join(output, 'build.json'),
    JSON.stringify({
      identity: {
        platform: 'win32',
        architecture: 'x64',
        revision: 8,
        sources: Object.fromEntries(
          Object.entries(SOURCES).map(([name, source]) => [
            name,
            { version: source.version, sha256: source.sha256 },
          ]),
        ),
      },
      binaries: { ffmpeg: 'a'.repeat(64), ffprobe: 'b'.repeat(64) },
      toolchain: record,
    }),
  );
  await afterPack(context);
  const otherBuild = structuredClone(record);
  otherBuild.files['libgcc/COPYING.RUNTIME'] = 'a'.repeat(64);
  await writeFile(
    join(output, 'build.json'),
    JSON.stringify({
      ...JSON.parse(await readFile(join(output, 'build.json'), 'utf8')),
      toolchain: otherBuild,
    }),
  );
  await assert.rejects(afterPack(context), /binary build record/);
});

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
      revision: 8,
      sources: Object.fromEntries(
        Object.entries(SOURCES).map(([name, value]) => [
          name,
          { version: value.version, sha256: value.sha256 },
        ]),
      ),
    },
    binaries: { ffmpeg: 'a'.repeat(64), ffprobe: 'b'.repeat(64) },
    toolchain: toolchainFixtureRecord(),
    localDiagnostic: '/private/example',
  };
  assert.equal(
    validateBuildManifest(manifest, 'win32-x64').localDiagnostic,
    undefined,
  );
  assert.throws(
    () =>
      validateBuildManifest({ ...manifest, toolchain: undefined }, 'win32-x64'),
    /Incomplete Windows/,
  );
  assert.throws(
    () => validateBuildManifest(manifest, 'darwin-x64'),
    /target mismatch/,
  );
  const legacy = structuredClone(manifest);
  legacy.identity.revision = 7;
  assert.throws(
    () => validateBuildManifest(legacy, 'win32-x64'),
    /Media Foundation/,
  );
  legacy.identity.revision = 8;
  legacy.identity.sources.openh264 = {
    version: '2.6.0',
    sha256: 'c'.repeat(64),
  };
  assert.throws(
    () => validateBuildManifest(legacy, 'win32-x64'),
    /Incomplete source identity/,
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
