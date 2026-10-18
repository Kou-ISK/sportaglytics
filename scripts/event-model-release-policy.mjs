import { createHash } from 'node:crypto';

export const releaseTargets = ['darwin-arm64', 'darwin-x64', 'win32-x64'];
export const evidenceKinds = [
  'upstream',
  'distribution',
  'runtime',
  'evaluation',
  'build',
];
export const sha256 = (bytes) =>
  createHash('sha256').update(bytes).digest('hex');
export const requirePolicy = (condition, field) => {
  // Never echo unreviewed metadata, URLs or private local paths.
  if (!condition) throw new Error(`Event model release policy: ${field}`);
};
const object = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const keys = (value, expected, field) => {
  requirePolicy(object(value), field);
  requirePolicy(
    Object.keys(value).length === expected.length &&
      expected.every((key) => Object.hasOwn(value, key)),
    `${field} fields`,
  );
};
const hash = (value) =>
  typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const versionParts = (value) => {
  requirePolicy(typeof value === 'string' && value.length <= 100, 'version');
  const match = value.match(
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/,
  );
  requirePolicy(match, 'version');
  const pre = match[4]?.split('.') ?? [];
  requirePolicy(
    pre.every((part) => !/^\d+$/.test(part) || /^(0|[1-9]\d*)$/.test(part)),
    'version prerelease',
  );
  return { core: match.slice(1, 4).map(BigInt), pre };
};
export const compareVersions = (left, right) => {
  const a = versionParts(left);
  const b = versionParts(right);
  for (let i = 0; i < 3; i++) {
    if (a.core[i] !== b.core[i]) return a.core[i] > b.core[i] ? 1 : -1;
  }
  if (!a.pre.length || !b.pre.length)
    return Number(!a.pre.length) - Number(!b.pre.length);
  for (let i = 0; i < Math.max(a.pre.length, b.pre.length); i++) {
    if (a.pre[i] === undefined) return -1;
    if (b.pre[i] === undefined) return 1;
    if (a.pre[i] === b.pre[i]) continue;
    const an = /^\d+$/.test(a.pre[i]);
    const bn = /^\d+$/.test(b.pre[i]);
    if (an !== bn) return an ? -1 : 1;
    return (an ? BigInt(a.pre[i]) > BigInt(b.pre[i]) : a.pre[i] > b.pre[i])
      ? 1
      : -1;
  }
  return 0;
};
const versions = (values) => {
  requirePolicy(Array.isArray(values) && values.length > 0, 'appVersions');
  values.forEach(versionParts);
  requirePolicy(
    new Set(values).size === values.length,
    'duplicate appVersions',
  );
};
const targets = (values) => {
  requirePolicy(
    Array.isArray(values) &&
      values.length > 0 &&
      values.every((value) => releaseTargets.includes(value)) &&
      new Set(values).size === values.length,
    'targets',
  );
};
export const validateEvidenceReference = (reference) => {
  keys(reference, ['path', 'sha256'], 'evidence reference');
  requirePolicy(
    typeof reference.path === 'string' &&
      /^evidence\/[a-zA-Z0-9_./-]+\.(md|json|txt)$/.test(reference.path) &&
      reference.path
        .split('/')
        .every((part) => part && part !== '.' && part !== '..'),
    'evidence path',
  );
  requirePolicy(hash(reference.sha256), 'evidence SHA-256');
};
const canonical = (value) => {
  if (Array.isArray(value)) return value.map(canonical);
  if (object(value))
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])]),
    );
  return value;
};
export const candidateDigest = (candidate) =>
  sha256(JSON.stringify(canonical(candidate)));

export const validateCatalog = (catalog) => {
  keys(catalog, ['schemaVersion', 'modelId', 'candidates'], 'catalog');
  requirePolicy(catalog.schemaVersion === 1, 'catalog schemaVersion');
  requirePolicy(
    Array.isArray(catalog.candidates) && catalog.candidates.length <= 1000,
    'candidates',
  );
  requirePolicy(
    catalog.modelId === null
      ? catalog.candidates.length === 0
      : typeof catalog.modelId === 'string' &&
          /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(catalog.modelId),
    'modelId',
  );
  const seen = new Set();
  for (const candidate of catalog.candidates) {
    keys(
      candidate,
      ['version', 'state', 'appVersions', 'quality', 'evidence', 'targets'],
      'candidate',
    );
    versionParts(candidate.version);
    requirePolicy(!seen.has(candidate.version), 'duplicate model version');
    seen.add(candidate.version);
    requirePolicy(
      ['approved', 'pending', 'withdrawn'].includes(candidate.state),
      'candidate state',
    );
    versions(candidate.appVersions);
    requirePolicy(
      ['experimental', 'verified'].includes(candidate.quality),
      'quality',
    );
    keys(candidate.evidence, evidenceKinds, 'candidate evidence');
    Object.values(candidate.evidence).forEach(validateEvidenceReference);
    requirePolicy(object(candidate.targets), 'candidate targets');
    targets(Object.keys(candidate.targets));
    for (const artifact of Object.values(candidate.targets)) {
      keys(
        artifact,
        [
          'archiveSha256',
          'archiveBytes',
          'manifestSha256',
          'provenanceSha256',
          'qualification',
        ],
        'target artifact',
      );
      requirePolicy(
        ['archiveSha256', 'manifestSha256', 'provenanceSha256'].every((key) =>
          hash(artifact[key]),
        ),
        'artifact SHA-256',
      );
      requirePolicy(
        Number.isSafeInteger(artifact.archiveBytes) &&
          artifact.archiveBytes > 0,
        'archiveBytes',
      );
      validateEvidenceReference(artifact.qualification);
    }
  }
};

export const selectLatestEligible = (catalog, appVersion, requiredTargets) => {
  validateCatalog(catalog);
  versionParts(appVersion);
  targets(requiredTargets);
  return (
    catalog.candidates
      .filter(
        (candidate) =>
          candidate.state === 'approved' &&
          candidate.appVersions.includes(appVersion) &&
          requiredTargets.every((target) =>
            Object.hasOwn(candidate.targets, target),
          ),
      )
      .sort((a, b) => compareVersions(b.version, a.version))[0] ?? null
  );
};

export const validateReleaseLock = (
  catalog,
  catalogBytes,
  lock,
  appVersion,
) => {
  keys(
    lock,
    [
      'schemaVersion',
      'appVersion',
      'catalogSha256',
      'targets',
      'mode',
      'selection',
      'decision',
    ],
    'lock',
  );
  requirePolicy(lock.schemaVersion === 1, 'lock schemaVersion');
  requirePolicy(lock.appVersion === appVersion, 'application version mismatch');
  requirePolicy(
    lock.catalogSha256 === sha256(catalogBytes),
    'catalog SHA-256 mismatch',
  );
  // A target subset must not silently turn a Mac-only model into a desktop release.
  requirePolicy(
    JSON.stringify(lock.targets) === JSON.stringify(releaseTargets),
    'desktop target set',
  );
  validateEvidenceReference(lock.decision);
  requirePolicy(
    ['none', 'latest'].includes(lock.mode),
    'mode (rollback requires a separately reviewed implementation)',
  );
  const selected = selectLatestEligible(catalog, appVersion, lock.targets);
  if (lock.mode === 'none') {
    requirePolicy(
      lock.selection === null && selected === null,
      'none mode has an eligible candidate',
    );
  } else {
    requirePolicy(selected !== null, 'no eligible candidate');
    keys(
      lock.selection,
      ['modelId', 'version', 'candidateSha256'],
      'selection',
    );
    requirePolicy(
      lock.selection.modelId === catalog.modelId &&
        lock.selection.version === selected.version &&
        lock.selection.candidateSha256 === candidateDigest(selected),
      'selected candidate mismatch',
    );
  }
  return selected;
};
