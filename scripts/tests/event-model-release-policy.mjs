import assert from 'node:assert/strict';
import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  candidateDigest,
  compareVersions,
  evidenceKinds,
  releaseTargets,
  selectLatestEligible,
  sha256,
  validateCatalog,
  validateReleaseLock,
} from '../event-model-release-policy.mjs';
import { checkReleasePlan } from '../check-event-model-release.mjs';

const repository = fileURLToPath(new URL('../../', import.meta.url));
const appVersion = '1.2.0';
const evidenceBytes = Buffer.from(
  'Synthetic public review; no actual model approval.\n',
);
const reference = () => ({
  path: 'evidence/synthetic.md',
  sha256: sha256(evidenceBytes),
});
const candidate = (version = '0.6.0-experimental.1') => ({
  version,
  state: 'approved',
  appVersions: [appVersion],
  quality: 'experimental',
  evidence: Object.fromEntries(evidenceKinds.map((key) => [key, reference()])),
  targets: Object.fromEntries(
    releaseTargets.map((target) => [
      target,
      {
        archiveSha256: sha256('synthetic archive'),
        archiveBytes: 17,
        manifestSha256: sha256('synthetic manifest'),
        provenanceSha256: sha256('synthetic provenance'),
        qualification: reference(),
      },
    ]),
  ),
});
const catalogOf = (...candidates) => ({
  schemaVersion: 1,
  modelId: candidates.length ? 'synthetic-events' : null,
  candidates,
});
const encoded = (value) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
const lockFor = (
  catalog,
  selected = selectLatestEligible(catalog, appVersion, releaseTargets),
) => ({
  schemaVersion: 1,
  appVersion,
  catalogSha256: sha256(encoded(catalog)),
  targets: [...releaseTargets],
  mode: selected ? 'latest' : 'none',
  selection: selected
    ? {
        modelId: catalog.modelId,
        version: selected.version,
        candidateSha256: candidateDigest(selected),
      }
    : null,
  decision: reference(),
});

test('version ordering handles numeric core, prerelease identifiers and release precedence', () => {
  const ordered = [
    '0.6.0-alpha',
    '0.6.0-alpha.2',
    '0.6.0-alpha.10',
    '0.6.0-beta',
    '0.6.0',
    '0.10.0',
    '1.0.0',
  ];
  for (let i = 1; i < ordered.length; i++) {
    assert.equal(compareVersions(ordered[i - 1], ordered[i]), -1);
    assert.equal(compareVersions(ordered[i], ordered[i - 1]), 1);
  }
  assert.equal(compareVersions('0.6.0', '0.6.0'), 0);
  for (const value of [
    'latest',
    '01.0.0',
    '1.0.0-01',
    '1.0',
    '1.0.0+ambiguous',
    ' 1.0.0',
  ]) {
    assert.throws(() => compareVersions(value, '1.0.0'), /version/);
  }
});

test('selects the newest approved compatible candidate, independent of input order', () => {
  const eligible = candidate('0.10.0');
  const old = candidate('0.9.0');
  const pending = { ...candidate('2.0.0'), state: 'pending' };
  const withdrawn = { ...candidate('3.0.0'), state: 'withdrawn' };
  const incompatible = { ...candidate('4.0.0'), appVersions: ['9.0.0'] };
  const macOnly = candidate('5.0.0');
  delete macOnly.targets['win32-x64'];
  const catalog = catalogOf(
    pending,
    incompatible,
    old,
    macOnly,
    eligible,
    withdrawn,
  );
  const before = structuredClone(catalog);
  assert.deepEqual(
    selectLatestEligible(catalog, appVersion, releaseTargets),
    eligible,
  );
  assert.deepEqual(catalog, before);
  catalog.candidates.reverse();
  assert.deepEqual(
    selectLatestEligible(catalog, appVersion, releaseTargets),
    eligible,
  );
});

test('malformed and conflicting metadata fail rather than silently selecting an older model', () => {
  assert.throws(
    () => validateCatalog(catalogOf(candidate(), candidate())),
    /duplicate/,
  );
  for (const mutate of [
    (c) => {
      c.schemaVersion = 2;
    },
    (c) => {
      c.unknown = true;
    },
    (c) => {
      c.candidates[0].state = 'trusted';
    },
    (c) => {
      c.candidates[0].quality = 'accurate';
    },
    (c) => {
      c.candidates[0].evidence.upstream.path = 'evidence/../../private.txt';
    },
    (c) => {
      c.candidates[0].evidence.runtime.sha256 = 'unknown';
    },
    (c) => {
      c.candidates[0].targets['win32-x64'].archiveBytes = 0;
    },
  ]) {
    const catalog = catalogOf(candidate());
    mutate(catalog);
    assert.throws(
      () => selectLatestEligible(catalog, appVersion, releaseTargets),
      /Event model release policy:/,
    );
  }
});

test('lock binds catalog bytes, exact application version, all targets and latest candidate', () => {
  const catalog = catalogOf(candidate());
  const lock = lockFor(catalog);
  assert.deepEqual(
    validateReleaseLock(catalog, encoded(catalog), lock, appVersion),
    catalog.candidates[0],
  );
  assert.throws(
    () =>
      validateReleaseLock(
        catalog,
        Buffer.concat([encoded(catalog), Buffer.from(' ')]),
        lock,
        appVersion,
      ),
    /catalog SHA/,
  );
  assert.throws(
    () => validateReleaseLock(catalog, encoded(catalog), lock, '1.2.1'),
    /application version/,
  );
  for (const mutate of [
    (l) => {
      l.selection.version = '0.1.0';
    },
    (l) => {
      l.selection.candidateSha256 = sha256('different');
    },
    (l) => {
      l.targets.pop();
    },
    (l) => {
      l.mode = 'none';
      l.selection = null;
    },
    (l) => {
      l.mode = 'rollback';
    },
  ]) {
    const changed = structuredClone(lock);
    mutate(changed);
    assert.throws(
      () => validateReleaseLock(catalog, encoded(catalog), changed, appVersion),
      /Event model release policy:/,
    );
  }
  catalog.candidates.push(candidate('0.7.0'));
  lock.catalogSha256 = sha256(encoded(catalog));
  assert.throws(
    () => validateReleaseLock(catalog, encoded(catalog), lock, appVersion),
    /selected candidate/,
  );
});

test('no eligible public candidate requires an explicit none decision', () => {
  const catalog = catalogOf();
  const lock = lockFor(catalog);
  assert.equal(
    validateReleaseLock(catalog, encoded(catalog), lock, appVersion),
    null,
  );
  lock.mode = 'latest';
  assert.throws(
    () => validateReleaseLock(catalog, encoded(catalog), lock, appVersion),
    /no eligible/,
  );
});

test('candidate digest ignores object key order and changes when evidence or artifact bytes change', () => {
  const value = candidate();
  assert.equal(
    candidateDigest(value),
    candidateDigest(Object.fromEntries(Object.entries(value).reverse())),
  );
  const changed = structuredClone(value);
  changed.targets['darwin-arm64'].archiveSha256 = sha256('changed');
  assert.notEqual(candidateDigest(value), candidateDigest(changed));
});

const fixture = async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'event-release-policy-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const policy = join(root, 'resources/event-model-release');
  await mkdir(join(policy, 'evidence'), { recursive: true });
  const catalog = catalogOf(candidate());
  await writeFile(join(root, 'package.json'), encoded({ version: appVersion }));
  await writeFile(join(policy, 'catalog.json'), encoded(catalog));
  await writeFile(join(policy, 'lock.json'), encoded(lockFor(catalog)));
  await writeFile(join(policy, 'evidence/synthetic.md'), evidenceBytes);
  return { root, policy };
};

test('real file hashes reject changed and missing public evidence without rewriting inputs', async (t) => {
  const { root, policy } = await fixture(t);
  assert.equal((await checkReleasePlan(root)).version, '0.6.0-experimental.1');
  const lockBefore = await readFile(join(policy, 'lock.json'));
  await writeFile(join(policy, 'evidence/synthetic.md'), 'Changed review');
  await assert.rejects(checkReleasePlan(root), /evidence bytes mismatch/);
  assert.deepEqual(await readFile(join(policy, 'lock.json')), lockBefore);
  await rm(join(policy, 'evidence/synthetic.md'));
  await assert.rejects(checkReleasePlan(root));
});

test('CLI fails closed on bad metadata and does not print its contents or private paths', async (t) => {
  const { root, policy } = await fixture(t);
  await writeFile(
    join(policy, 'catalog.json'),
    'PRIVATE_SENTINEL_INVALID_JSON',
  );
  const result = spawnSync(
    process.execPath,
    [join(repository, 'scripts/check-event-model-release.mjs'), root],
    { encoding: 'utf8' },
  );
  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /invalid JSON/);
  assert.ok(
    !result.stderr.includes('PRIVATE_SENTINEL') &&
      !result.stderr.includes(root),
  );
});

test('evidence parent directory symlinks are rejected', async (t) => {
  const { root, policy } = await fixture(t);
  await rm(join(policy, 'evidence/synthetic.md'));
  // File symlink creation needs Windows privileges; a directory junction does not.
  await rm(join(policy, 'evidence'), { recursive: true });
  await mkdir(join(root, 'outside'));
  await writeFile(join(root, 'outside/synthetic.md'), evidenceBytes);
  await symlink(
    join(root, 'outside'),
    join(policy, 'evidence'),
    process.platform === 'win32' ? 'junction' : 'dir',
  );
  await assert.rejects(checkReleasePlan(root), /symlink/);
});

test('checked-in application policy is valid and does not require a private model', async () => {
  const result = await checkReleasePlan(repository);
  const pkg = JSON.parse(
    await readFile(join(repository, 'package.json'), 'utf8'),
  );
  assert.equal(result.appVersion, pkg.version);
  assert.ok(['none', 'latest'].includes(result.mode));
});
