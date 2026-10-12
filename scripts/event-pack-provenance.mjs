import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const PROVENANCE = 'distribution-provenance.json';
const MANIFEST = 'manifest.json';
const SHA256 = /^[a-f0-9]{64}$/i;
const UNKNOWN =
  /^(unknown|unconfirmed|unverified|pending|tbd|todo|n\/a|none|noassertion)$/i;
const fail = (field) => {
  // Report the field, never its potentially private value or a local path.
  throw new Error(`Event pack distribution provenance: ${field}`);
};
const requireValue = (condition, field) => {
  if (!condition) fail(field);
};
const record = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value) =>
  typeof value === 'string' &&
  value.trim().length > 0 &&
  !UNKNOWN.test(value.trim());
const keys = (value, expected, field) => {
  requireValue(record(value), field);
  requireValue(
    Object.keys(value).length === expected.length &&
      expected.every((key) => Object.hasOwn(value, key)),
    `${field} fields`,
  );
};
const relativePath = (value) =>
  typeof value === 'string' &&
  value.length > 0 &&
  !/[\\:\x00-\x1f\x7f]/.test(value) &&
  value.split('/').every((part) => part && part !== '.' && part !== '..');
const publicUrl = (value) => {
  try {
    const url = new URL(value);
    return (
      typeof value === 'string' &&
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
};
const isSourceRevision = (value, sourceHash) => {
  if (!text(value)) return false;
  const revision = value.trim();
  if (
    /^(main|master|develop|latest|HEAD)$/i.test(revision) ||
    /^refs\/(heads|remotes)(\/|$)/i.test(revision)
  )
    return false;
  if (/^sha256\s*:/i.test(revision)) {
    const match = revision.match(/^sha256:([a-f0-9]{64})$/i);
    return Boolean(
      match && match[1].toLowerCase() === sourceHash.toLowerCase(),
    );
  }
  // Opaque release/checkpoint versions and tags remain valid declarations.
  // Their actual immutability is part of the human source review.
  return true;
};
const hashFile = async (file) => {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
};
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const json = (bytes, field) => {
  try {
    return JSON.parse(bytes.toString('utf8'));
  } catch {
    return fail(`${field} JSON`);
  }
};

const listFiles = async (root, prefix = '') => {
  const files = [];
  for (const entry of await readdir(join(root, prefix), {
    withFileTypes: true,
  })) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    requireValue(relativePath(path), 'non-portable file path');
    if (entry.isDirectory()) files.push(...(await listFiles(root, path)));
    else {
      requireValue(entry.isFile(), 'symlink or non-regular file');
      files.push(path);
    }
  }
  return files.sort();
};

const validatePack = async (directory) => {
  const allFiles = await listFiles(directory);
  requireValue(
    allFiles.includes(PROVENANCE),
    'missing distribution-provenance.json',
  );
  requireValue(allFiles.includes(MANIFEST), 'missing manifest.json');
  const manifestBytes = await readFile(join(directory, MANIFEST));
  const manifest = json(manifestBytes, 'manifest');
  requireValue(
    record(manifest) &&
      [1, 2].includes(manifest.schemaVersion) &&
      text(manifest.id) &&
      text(manifest.version) &&
      record(manifest.runners) &&
      Object.keys(manifest.runners).length > 0,
    'manifest identity or runners',
  );
  const provenance = json(
    await readFile(join(directory, PROVENANCE)),
    'provenance',
  );
  keys(
    provenance,
    [
      'schemaVersion',
      'manifestSha256',
      'review',
      'trainingData',
      'components',
      'files',
    ],
    'provenance',
  );
  requireValue(provenance.schemaVersion === 1, 'schemaVersion');
  requireValue(
    provenance.manifestSha256 === digest(manifestBytes),
    'manifestSha256 mismatch',
  );
  keys(
    provenance.review,
    ['decision', 'reviewedBy', 'reviewedAt', 'record'],
    'review',
  );
  requireValue(
    provenance.review.decision === 'approved-for-public-distribution',
    'review decision',
  );
  requireValue(text(provenance.review.reviewedBy), 'review.reviewedBy');
  const date = provenance.review.reviewedAt;
  requireValue(
    typeof date === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(date) &&
      Number.isFinite(Date.parse(date)) &&
      new Date(date).toISOString().startsWith(date),
    'review.reviewedAt',
  );
  keys(provenance.trainingData, ['status', 'record'], 'trainingData');
  requireValue(
    provenance.trainingData.status === 'reviewed',
    'trainingData.status',
  );
  requireValue(record(provenance.files), 'files');
  const expectedFiles = allFiles.filter(
    (file) => file !== MANIFEST && file !== PROVENANCE,
  );
  const declaredFiles = Object.keys(provenance.files).sort();
  requireValue(
    declaredFiles.length === expectedFiles.length &&
      declaredFiles.every((file, index) => file === expectedFiles[index]),
    'file inventory mismatch',
  );
  for (const file of declaredFiles) {
    const expected = provenance.files[file];
    requireValue(
      typeof expected === 'string' && SHA256.test(expected),
      'file SHA-256',
    );
    requireValue(
      (await hashFile(join(directory, file))) === expected.toLowerCase(),
      'file SHA-256 mismatch',
    );
  }

  const covered = new Set();
  const requiredTextFiles = new Set();
  const fileReference = (file, field, isText = false) => {
    requireValue(
      relativePath(file) && Object.hasOwn(provenance.files, file),
      field,
    );
    covered.add(file);
    if (isText) requiredTextFiles.add(file);
  };
  fileReference(provenance.review.record, 'review.record', true);
  fileReference(provenance.trainingData.record, 'trainingData.record', true);
  requireValue(
    Array.isArray(provenance.components) && provenance.components.length > 0,
    'components',
  );
  const ids = new Set();
  const runnerFiles = new Set();
  let hasModel = false;
  for (const [index, component] of provenance.components.entries()) {
    const field = `components[${index}]`;
    keys(
      component,
      [
        'id',
        'kind',
        'source',
        'license',
        'licenseFiles',
        'noticeFiles',
        'usageRestrictions',
        'artifactPaths',
      ],
      field,
    );
    requireValue(
      typeof component.id === 'string' &&
        /^[a-z0-9][a-z0-9-]*$/.test(component.id) &&
        !ids.has(component.id),
      `${field}.id`,
    );
    ids.add(component.id);
    requireValue(
      ['model', 'runner', 'dependency'].includes(component.kind),
      `${field}.kind`,
    );
    hasModel ||= component.kind === 'model';
    keys(component.source, ['url', 'revision', 'sha256'], `${field}.source`);
    requireValue(publicUrl(component.source.url), `${field}.source.url`);
    requireValue(
      typeof component.source.sha256 === 'string' &&
        SHA256.test(component.source.sha256),
      `${field}.source.sha256`,
    );
    requireValue(
      isSourceRevision(component.source.revision, component.source.sha256),
      `${field}.source.revision`,
    );
    requireValue(text(component.license), `${field}.license`);
    requireValue(
      Array.isArray(component.usageRestrictions) &&
        component.usageRestrictions.every(text),
      `${field}.usageRestrictions`,
    );
    for (const list of ['licenseFiles', 'noticeFiles', 'artifactPaths']) {
      requireValue(
        Array.isArray(component[list]) &&
          (list === 'noticeFiles' || component[list].length > 0),
        `${field}.${list}`,
      );
      for (const file of component[list]) {
        fileReference(file, `${field}.${list}`, list !== 'artifactPaths');
        if (list === 'artifactPaths' && component.kind === 'runner')
          runnerFiles.add(file);
      }
    }
  }
  requireValue(
    hasModel && runnerFiles.size > 0,
    'model and runner components required',
  );
  requireValue(
    declaredFiles.every((file) => covered.has(file)),
    'unclassified file',
  );
  for (const runner of Object.values(manifest.runners)) {
    requireValue(
      record(runner) && runnerFiles.has(runner.path),
      'runner artifact reference',
    );
    requireValue(
      typeof runner.sha256 === 'string' &&
        SHA256.test(runner.sha256) &&
        runner.sha256.toLowerCase() ===
          provenance.files[runner.path].toLowerCase(),
      'runner SHA-256 mismatch',
    );
  }
  for (const file of requiredTextFiles) {
    requireValue(
      (await readFile(join(directory, file), 'utf8')).trim().length > 0,
      'empty review or license/NOTICE text',
    );
  }
};

/** Validate the complete pre-signing resource snapshot; never run a model or fetch a source. */
export const validateEventPackDistribution = async (modelsRoot) => {
  try {
    let root;
    try {
      root = await lstat(modelsRoot);
    } catch (error) {
      if (error?.code === 'ENOENT') return 0;
      throw error;
    }
    requireValue(root.isDirectory(), 'model root must be a real directory');
    let count = 0;
    for (const entry of await readdir(modelsRoot, { withFileTypes: true })) {
      if (
        entry.name === '.gitkeep' &&
        entry.isFile() &&
        (await lstat(join(modelsRoot, entry.name))).size === 0
      )
        continue;
      requireValue(entry.isDirectory(), 'unexpected model root entry');
      await validatePack(join(modelsRoot, entry.name));
      count += 1;
    }
    return count;
  } catch (error) {
    if (error?.message?.startsWith('Event pack distribution provenance:'))
      throw error;
    // fs/JSON exceptions can include private paths and source values.
    return fail('unreadable pack evidence');
  }
};
