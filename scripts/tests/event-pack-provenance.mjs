import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  chmod,
  mkdtemp,
  mkdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import afterPack from '../after-pack.mjs';
import { validateEventPackDistribution } from '../event-pack-provenance.mjs';
import { signModelDirectory } from '../sign-event-detection-runners-after-pack.mjs';
import { SOURCES } from '../media-tools/sources.mjs';
import { TOOLCHAIN_NOTICES } from '../media-tools/toolchain-notices.mjs';
import { copyMacLlamaNotices } from '../mac-llama-notices.mjs';

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
const provenanceName = 'distribution-provenance.json';

// Synthetic bytes only: these records are not approval for a real model.
const fixture = async (t) => {
  const resources = await mkdtemp(join(tmpdir(), 'event-provenance-test-'));
  t.after(() => rm(resources, { recursive: true, force: true }));
  const modelsRoot = join(resources, 'event-detection-models');
  const directory = join(modelsRoot, 'synthetic-pack');
  const files = {
    'runner/infer': 'synthetic runner, never executed',
    'weights.bin': 'synthetic weights, never loaded',
    'LICENSE.txt': 'Synthetic license text for fixture only',
    'NOTICE.txt': 'Synthetic upstream notice for fixture only',
    'review.md': 'Synthetic review; no real model approved.',
    'data-review.md': 'Synthetic generated samples; no actual training data.',
  };
  for (const [path, contents] of Object.entries(files)) {
    const target = join(directory, path);
    await mkdir(join(target, '..'), { recursive: true });
    await writeFile(target, contents);
  }
  const manifest = {
    schemaVersion: 1,
    id: 'synthetic-pack',
    version: '0.0.0-test',
    displayName: 'Synthetic test fixture',
    status: 'experimental',
    events: ['scrum'],
    metrics: {},
    runners: {
      'darwin-arm64': {
        path: 'runner/infer',
        sha256: hash(files['runner/infer']),
      },
    },
  };
  const component = (id, kind, artifactPaths) => ({
    id,
    kind,
    source: {
      url: `https://example.invalid/${id}/source.bin`,
      revision: 'synthetic-v1',
      sha256: hash(`synthetic ${id} source`),
    },
    license: 'LicenseRef-Synthetic-Tests-Only',
    licenseFiles: ['LICENSE.txt'],
    noticeFiles: ['NOTICE.txt'],
    usageRestrictions: ['Synthetic fixture; not usable as a model'],
    artifactPaths,
  });
  const provenance = {
    schemaVersion: 1,
    manifestSha256: hash(json(manifest)),
    review: {
      decision: 'approved-for-public-distribution',
      reviewedBy: 'synthetic-test-reviewer',
      reviewedAt: '2026-10-12',
      record: 'review.md',
    },
    trainingData: { status: 'reviewed', record: 'data-review.md' },
    components: [
      component('model', 'model', ['weights.bin']),
      component('runner', 'runner', ['runner/infer']),
    ],
    files: Object.fromEntries(
      Object.entries(files).map(([path, bytes]) => [path, hash(bytes)]),
    ),
  };
  const save = async () => {
    await writeFile(join(directory, 'manifest.json'), json(manifest));
    await writeFile(join(directory, provenanceName), json(provenance));
  };
  await save();
  return { resources, modelsRoot, directory, manifest, provenance, save };
};

const distributionNotices = async (resources) => {
  const llama = join(resources, 'llama/darwin');
  await mkdir(llama, { recursive: true });
  const embedded = await Promise.all(
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
  await writeFile(join(llama, 'llama-completion'), Buffer.concat(embedded));
  await copyMacLlamaNotices(llama, 'b7849');
  await mkdir(join(resources, 'licenses'), { recursive: true });
  await writeFile(join(resources, 'LICENSE'), 'Synthetic application license');
  await writeFile(
    join(resources, 'THIRD_PARTY_NOTICES.md'),
    'Synthetic application notices',
  );
  await writeFile(
    join(resources, 'licenses/renderer.json'),
    '[{"name":"synthetic"}]',
  );
  await writeFile(join(resources, 'licenses/preload.json'), '[]');
  await mkdir(join(resources, 'media-tools/licenses'), { recursive: true });
  for (const name of [
    'ffmpeg-COPYING.LGPLv2.1',
    'freetype-LICENSE.TXT',
    'freetype-FTL.TXT',
    'harfbuzz-COPYING',
    'zlib-LICENSE',
  ]) {
    await writeFile(
      join(resources, 'media-tools/licenses', name),
      'Synthetic native notice',
    );
  }
  // Keep this packaging fixture complete when Windows native notice gates run.
  const toolchain = {
    schemaVersion: 1,
    compilerVersion: '16.2.0',
    packages: {},
    files: {},
  };
  const root = join(resources, 'media-tools/licenses/toolchain');
  for (const [pkg, names] of Object.entries(TOOLCHAIN_NOTICES)) {
    toolchain.packages[pkg] = ['libgcc', 'libstdc++'].includes(pkg)
      ? '16.2.0-4'
      : '14.0.0-1';
    await mkdir(join(root, pkg), { recursive: true });
    for (const name of names) {
      const text = 'Synthetic compiler runtime notice';
      toolchain.files[`${pkg}/${name}`] = hash(text);
      await writeFile(join(root, pkg, name), text);
    }
  }
  await writeFile(join(root, 'manifest.json'), json(toolchain));
  await writeFile(
    join(resources, 'media-tools/build.json'),
    json({
      identity: {
        revision: 8,
        platform: 'win32',
        architecture: 'x64',
        sources: Object.fromEntries(
          Object.entries(SOURCES).map(([name, source]) => [
            name,
            { version: source.version, sha256: source.sha256 },
          ]),
        ),
      },
      binaries: { ffmpeg: 'a'.repeat(64), ffprobe: 'b'.repeat(64) },
      toolchain,
    }),
  );
};

test('no model remains a supported package, including an empty staging placeholder', async (t) => {
  const { resources, modelsRoot } = await fixture(t);
  await rm(modelsRoot, { recursive: true });
  assert.equal(await validateEventPackDistribution(modelsRoot), 0);
  await mkdir(modelsRoot);
  await writeFile(join(modelsRoot, '.gitkeep'), '');
  assert.equal(await validateEventPackDistribution(modelsRoot), 0);
  await distributionNotices(resources);
  await afterPack({
    appOutDir: resources,
    electronPlatformName: 'linux',
    packager: { getResourcesDir: () => resources },
  });
});

test('complete provenance and declared bytes pass packaging without executing the runner', async (t) => {
  const { resources, modelsRoot } = await fixture(t);
  assert.equal(await validateEventPackDistribution(modelsRoot), 1);
  await distributionNotices(resources);
  await afterPack({
    appOutDir: resources,
    electronPlatformName: 'win32',
    packager: { getResourcesDir: () => resources },
  });
});

test('revision checks reject branch references and bind the SHA-256 fallback to source bytes', async (t) => {
  const rejected = [
    ' main ',
    'refs/heads/main',
    ' refs/heads/release/v1.2.3 ',
    'refs/remotes/origin/main',
    ' latest ',
    `sha256:${'0'.repeat(64)}`,
    'sha256:invalid',
    'sha256:',
  ];
  for (const revision of rejected) {
    await t.test(`reject ${revision.trim()}`, async (t) => {
      const f = await fixture(t);
      f.provenance.components[0].source.revision = revision;
      await f.save();
      await assert.rejects(
        validateEventPackDistribution(f.modelsRoot),
        /source.revision/,
      );
    });
  }
  const accepted = [
    ['commit', () => '0123456789abcdef0123456789abcdef01234567'],
    ['release', () => 'v1.2.3'],
    ['explicit tag', () => 'refs/tags/v1.2.3'],
    ['checkpoint version', () => ' synthetic-v1 '],
    ['matching digest', (sha) => `sha256:${sha}`],
    [
      'matching digest with case and whitespace',
      (sha) => ` SHA256:${sha.toUpperCase()} `,
    ],
  ];
  for (const [name, revision] of accepted) {
    await t.test(`accept ${name}`, async (t) => {
      const f = await fixture(t);
      const source = f.provenance.components[0].source;
      source.revision = revision(source.sha256);
      await f.save();
      assert.equal(await validateEventPackDistribution(f.modelsRoot), 1);
    });
  }
});

test('unreviewed or incomplete provenance is rejected, regardless of runtime quality status', async (t) => {
  const cases = [
    [
      'missing provenance',
      async (f) => rm(join(f.directory, provenanceName)),
      /missing distribution-provenance/,
    ],
    [
      'review pending',
      (f) => {
        f.provenance.review.decision = 'pending';
      },
      /review decision/,
    ],
    [
      'invalid review date',
      (f) => {
        f.provenance.review.reviewedAt = '2026-02-30';
      },
      /review.reviewedAt/,
    ],
    [
      'training data unreviewed',
      (f) => {
        f.provenance.trainingData.status = 'unknown';
      },
      /trainingData.status/,
    ],
    [
      'missing source hash',
      (f) => {
        delete f.provenance.components[0].source.sha256;
      },
      /source fields/,
    ],
    [
      'mutable source revision',
      (f) => {
        f.provenance.components[0].source.revision = 'main';
      },
      /source.revision/,
    ],
    [
      'unknown license',
      (f) => {
        f.provenance.components[0].license = 'unknown';
      },
      /license/,
    ],
    [
      'unasserted SPDX license',
      (f) => {
        f.provenance.components[0].license = 'NOASSERTION';
      },
      /license/,
    ],
    [
      'restrictions omitted',
      (f) => {
        delete f.provenance.components[0].usageRestrictions;
      },
      /fields/,
    ],
    [
      'missing license reference',
      (f) => {
        f.provenance.components[0].licenseFiles = [];
      },
      /licenseFiles/,
    ],
    [
      'missing NOTICE file',
      (f) => {
        f.provenance.components[0].noticeFiles = ['absent.txt'];
      },
      /noticeFiles/,
    ],
    [
      'no model component',
      (f) => {
        f.provenance.components[0].kind = 'dependency';
      },
      /model and runner/,
    ],
    [
      'unknown schema',
      (f) => {
        f.provenance.schemaVersion = 2;
      },
      /schemaVersion/,
    ],
    [
      'undeclared extra metadata',
      (f) => {
        f.provenance.localPath = 'synthetic-sensitive-marker';
      },
      /provenance fields/,
    ],
  ];
  for (const [name, change, expected] of cases) {
    await t.test(name, async (t) => {
      const f = await fixture(t);
      f.manifest.status = 'verified';
      f.provenance.manifestSha256 = hash(json(f.manifest));
      await change(f);
      if (name !== 'missing provenance') await f.save();
      await assert.rejects(
        validateEventPackDistribution(f.modelsRoot),
        expected,
      );
    });
  }
});

test('extra, omitted, or modified bytes invalidate the complete inventory', async (t) => {
  for (const target of [
    'weights.bin',
    'runner/infer',
    'LICENSE.txt',
    'NOTICE.txt',
    'review.md',
    'data-review.md',
  ]) {
    await t.test(target, async (t) => {
      const f = await fixture(t);
      await writeFile(join(f.directory, target), 'changed bytes');
      await assert.rejects(
        validateEventPackDistribution(f.modelsRoot),
        /file SHA-256 mismatch/,
      );
    });
  }
  const f = await fixture(t);
  await writeFile(join(f.directory, 'unlisted.bin'), 'not in the review');
  await assert.rejects(
    validateEventPackDistribution(f.modelsRoot),
    /file inventory mismatch/,
  );
  f.provenance.files['unlisted.bin'] = hash('not in the review');
  await f.save();
  await assert.rejects(
    validateEventPackDistribution(f.modelsRoot),
    /unclassified file/,
  );
  await rm(join(f.directory, 'unlisted.bin'));
  await assert.rejects(
    validateEventPackDistribution(f.modelsRoot),
    /file inventory mismatch/,
  );
});

test('review is bound to the exact manifest, and manifest runner hashes must agree', async (t) => {
  const f = await fixture(t);
  f.manifest.runners['darwin-arm64'].sha256 = '0'.repeat(64);
  await f.save();
  await assert.rejects(
    validateEventPackDistribution(f.modelsRoot),
    /manifestSha256 mismatch/,
  );
  f.provenance.manifestSha256 = hash(json(f.manifest));
  await f.save();
  await assert.rejects(
    validateEventPackDistribution(f.modelsRoot),
    /runner SHA-256 mismatch/,
  );
});

test('reject traversal, credential URLs and empty evidence without echoing values', async (t) => {
  const cases = [
    (f) => {
      f.provenance.review.record = '../synthetic-sensitive-marker';
    },
    (f) => {
      f.provenance.review.record = 'C:\\synthetic-sensitive-marker';
    },
    (f) => {
      f.provenance.components[0].source.url =
        'https://synthetic-sensitive-marker@example.invalid/source';
    },
    (f) => {
      f.provenance.components[0].source.url =
        'https://example.invalid/source?token=synthetic-sensitive-marker';
    },
  ];
  for (const change of cases) {
    const f = await fixture(t);
    change(f);
    await f.save();
    await assert.rejects(
      validateEventPackDistribution(f.modelsRoot),
      (error) => {
        assert.match(error.message, /Event pack distribution provenance:/);
        assert.ok(!error.message.includes('synthetic-sensitive-marker'));
        return true;
      },
    );
  }
  const f = await fixture(t);
  await writeFile(join(f.directory, 'LICENSE.txt'), '  ');
  f.provenance.files['LICENSE.txt'] = hash('  ');
  await f.save();
  await assert.rejects(
    validateEventPackDistribution(f.modelsRoot),
    /empty review or license/,
  );
});

test('symlinks and unexpected model root entries cannot escape the inventory', async (t) => {
  const f = await fixture(t);
  // Directory junctions also work without symlink privileges on Windows CI.
  await symlink(f.directory, join(f.modelsRoot, 'linked-pack'), 'junction');
  await assert.rejects(
    validateEventPackDistribution(f.modelsRoot),
    /unexpected model root entry/,
  );
  await rm(join(f.modelsRoot, 'linked-pack'));
  await symlink(f.resources, join(f.directory, 'linked-files'), 'junction');
  await assert.rejects(
    validateEventPackDistribution(f.modelsRoot),
    /symlink or non-regular file/,
  );
  await rm(join(f.directory, 'linked-files'));
  await writeFile(join(f.modelsRoot, 'stray.bin'), 'undeclared bytes');
  await assert.rejects(
    validateEventPackDistribution(f.modelsRoot),
    /unexpected model root entry/,
  );
});

test('packaging blocks an unreviewed pack before macOS signing begins', async (t) => {
  const f = await fixture(t);
  await distributionNotices(f.resources);
  await rm(join(f.directory, provenanceName));
  await assert.rejects(
    afterPack({
      appOutDir: f.resources,
      electronPlatformName: 'darwin',
      packager: {
        getResourcesDir: () => f.resources,
        get appInfo() {
          throw new Error('Signing must not start');
        },
      },
    }),
    /missing distribution-provenance/,
  );
});

test('macOS signing retains pre-signing evidence and updates only runtime runner hashes', async (t) => {
  const f = await fixture(t);
  await validateEventPackDistribution(f.modelsRoot);
  const before = await readFile(join(f.directory, provenanceName));
  await chmod(join(f.directory, 'runner/infer'), 0o700);
  await signModelDirectory({
    modelDirectory: f.directory,
    signing: {},
    signRunnerImpl: ({ runnerPath }) =>
      writeFile(runnerPath, 'synthetic signed bytes'),
  });
  const signed = JSON.parse(
    await readFile(join(f.directory, 'manifest.json'), 'utf8'),
  );
  assert.equal(
    signed.runners['darwin-arm64'].sha256,
    hash('synthetic signed bytes'),
  );
  assert.deepEqual(await readFile(join(f.directory, provenanceName)), before);
  // A signed output is not a new, approved pre-signing input.
  await assert.rejects(
    validateEventPackDistribution(f.modelsRoot),
    /manifestSha256 mismatch/,
  );
});
