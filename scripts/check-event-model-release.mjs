import { lstat, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  requirePolicy,
  sha256,
  validateEvidenceReference,
  validateReleaseLock,
} from './event-model-release-policy.mjs';

const readBounded = async (root, relative) => {
  let path = root;
  for (const part of relative.split('/')) {
    path = join(path, part);
    const stat = await lstat(path);
    requirePolicy(!stat.isSymbolicLink(), 'symlink');
  }
  const stat = await lstat(path);
  requirePolicy(
    stat.isFile() && stat.size > 0 && stat.size <= 1024 * 1024,
    'metadata size/type',
  );
  return readFile(path);
};
const parse = (bytes) => {
  try {
    return JSON.parse(bytes.toString('utf8'));
  } catch {
    throw new Error('Event model release policy: invalid JSON');
  }
};
export const checkReleasePlan = async (repository) => {
  const prefix = 'resources/event-model-release';
  const catalogBytes = await readBounded(repository, `${prefix}/catalog.json`);
  const catalog = parse(catalogBytes);
  const lock = parse(await readBounded(repository, `${prefix}/lock.json`));
  const pkg = parse(await readBounded(repository, 'package.json'));
  const selected = validateReleaseLock(
    catalog,
    catalogBytes,
    lock,
    pkg.version,
  );
  const references = [lock.decision];
  // Even withdrawn/pending public records must remain intact; no silent fallback.
  for (const candidate of catalog.candidates) {
    references.push(...Object.values(candidate.evidence));
    references.push(
      ...Object.values(candidate.targets).map((target) => target.qualification),
    );
  }
  for (const reference of references) {
    validateEvidenceReference(reference);
    const bytes = await readBounded(repository, `${prefix}/${reference.path}`);
    requirePolicy(
      sha256(bytes) === reference.sha256 &&
        bytes.toString('utf8').trim().length > 0,
      'evidence bytes mismatch',
    );
  }
  return {
    appVersion: pkg.version,
    mode: lock.mode,
    modelId: selected ? catalog.modelId : null,
    version: selected?.version ?? null,
  };
};

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    requirePolicy(process.argv.length <= 3, 'arguments');
    const result = await checkReleasePlan(resolve(process.argv[2] ?? '.'));
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    const message =
      error instanceof Error &&
      error.message.startsWith('Event model release policy:')
        ? error.message
        : 'Event model release policy: metadata unavailable';
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  }
}
