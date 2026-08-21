import { createHash } from 'node:crypto';
import { constants as fsConstants } from 'node:fs';
import { access, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const MANIFEST_FILENAME = 'manifest.json';

const sha256File = async (filePath) => {
  const { createReadStream } = await import('node:fs');
  return await new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });
};

const isPathInside = (directory, filePath) => {
  const relative = path.relative(directory, filePath);
  return relative.length > 0 && !relative.startsWith('..') && !path.isAbsolute(relative);
};

const run = async (command, args) => {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', shell: false });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} failed with code ${code ?? 'null'} signal ${signal ?? 'null'}`));
    });
  });
};

const capture = async (command, args) => {
  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) {
        resolve(stdout);
        return;
      }
      reject(
        new Error(
          `${command} failed with code ${code ?? 'null'} signal ${signal ?? 'null'}${stderr ? `: ${stderr.trim()}` : ''}`,
        ),
      );
    });
  });
};

export const selectDeveloperIdApplicationIdentity = (securityOutput, qualifier = null) => {
  const parsed = securityOutput
    .split('\n')
    .map((line) =>
      line.match(/^\s*\d+\)\s+([0-9A-F]{40})\s+"([^"]+)"\s*$/i),
    )
    .filter(Boolean)
    .map((match) => ({ hash: match[1], name: match[2] }))
    .filter(({ name }) => name.startsWith('Developer ID Application:'));

  // `security find-identity` can surface the exact same certificate more than
  // once when it is reachable through multiple keychain search-list entries.
  // Treat identical hash+name pairs as one identity, while still rejecting
  // genuinely distinct certificates that happen to share a display name.
  const identitiesByKey = new Map();
  for (const identity of parsed) {
    const key = `${identity.hash.toLowerCase()}\u0000${identity.name}`;
    if (!identitiesByKey.has(key)) identitiesByKey.set(key, identity);
  }
  const identities = [...identitiesByKey.values()];

  const normalizedQualifier = qualifier?.trim() || null;
  const matches = normalizedQualifier
    ? identities.filter(
        ({ hash, name }) =>
          hash.toLowerCase() === normalizedQualifier.toLowerCase() ||
          name === normalizedQualifier ||
          name.includes(normalizedQualifier),
      )
    : identities;

  if (matches.length === 0) {
    throw new Error(
      normalizedQualifier
        ? `no Developer ID Application identity matches: ${normalizedQualifier}`
        : 'no Developer ID Application signing identity is available for event-detection runners',
    );
  }
  if (matches.length > 1) {
    throw new Error(
      `multiple Developer ID Application identities are available; set CSC_NAME or mac.identity explicitly: ${matches
        .map(({ name }) => name)
        .join(', ')}`,
    );
  }
  return matches[0].name;
};

const resolveSigningContext = async (packager) => {
  const macOptions = packager.platformSpecificBuildOptions ?? {};
  if (macOptions.identity === null) {
    throw new Error('event-detection model packs require a macOS signing identity');
  }
  if (typeof macOptions.sign === 'string' || typeof macOptions.sign === 'function') {
    throw new Error('custom macOS signing is not supported for event-detection model packs');
  }

  const signingInfo = await packager.codeSigningInfo.value;
  const keychainFile = signingInfo?.keychainFile ?? null;
  const securityArgs = ['find-identity', '-v', '-p', 'codesigning'];
  if (keychainFile) securityArgs.push(keychainFile);
  const identityOutput = await capture('security', securityArgs);
  const qualifier = macOptions.identity ?? process.env.CSC_NAME ?? null;
  const identityName = selectDeveloperIdApplicationIdentity(identityOutput, qualifier);

  return { identityName, keychainFile };
};

const signRunner = async ({ runnerPath, identityName, keychainFile, entitlementsPath }) => {
  const args = [
    '--sign',
    identityName,
    '--force',
    '--timestamp',
    '--options',
    'runtime',
  ];
  if (keychainFile) args.push('--keychain', keychainFile);
  if (entitlementsPath) args.push('--entitlements', entitlementsPath);
  args.push(runnerPath);
  await run('codesign', args);
  await run('codesign', ['--verify', '--strict', '--verbose=2', runnerPath]);
};

export const signModelDirectory = async ({
  modelDirectory,
  signing,
  entitlementsPath,
  signRunnerImpl = signRunner,
}) => {
  const manifestPath = path.join(modelDirectory, MANIFEST_FILENAME);
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (!manifest || typeof manifest !== 'object' || !manifest.runners || typeof manifest.runners !== 'object') {
    throw new Error(`invalid event-detection manifest: ${manifestPath}`);
  }

  const darwinEntries = Object.entries(manifest.runners).filter(([key]) => key.startsWith('darwin-'));
  if (darwinEntries.length === 0) return false;

  const entriesByRunner = new Map();
  for (const [platformKey, runner] of darwinEntries) {
    if (!runner || typeof runner !== 'object' || typeof runner.path !== 'string' || !runner.path) {
      throw new Error(`invalid runner entry ${platformKey} in ${manifestPath}`);
    }
    const runnerPath = path.resolve(modelDirectory, runner.path);
    if (!isPathInside(modelDirectory, runnerPath)) {
      throw new Error(`runner escapes model directory: ${runner.path}`);
    }
    await access(runnerPath, fsConstants.X_OK);
    const list = entriesByRunner.get(runnerPath) ?? [];
    list.push([platformKey, runner]);
    entriesByRunner.set(runnerPath, list);
  }

  for (const [runnerPath, entries] of entriesByRunner) {
    await signRunnerImpl({ runnerPath, ...signing, entitlementsPath });
    const signedHash = await sha256File(runnerPath);
    for (const [, runner] of entries) runner.sha256 = signedHash;
  }

  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return true;
};

export default async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return;

  const appPath = path.join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.app`,
  );
  const modelsRoot = path.join(appPath, 'Contents', 'Resources', 'event-detection-models');

  let entries;
  try {
    entries = await readdir(modelsRoot, { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT') return;
    throw error;
  }
  const modelDirectories = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(modelsRoot, entry.name));
  if (modelDirectories.length === 0) return;

  const signing = await resolveSigningContext(context.packager);
  const inheritedEntitlements = context.packager.platformSpecificBuildOptions.entitlementsInherit;
  const entitlementsPath = inheritedEntitlements
    ? path.resolve(context.packager.projectDir, inheritedEntitlements)
    : null;

  let signedCount = 0;
  for (const modelDirectory of modelDirectories) {
    if (await signModelDirectory({ modelDirectory, signing, entitlementsPath })) signedCount += 1;
  }
  console.log(`Prepared ${signedCount} event-detection model pack(s) for macOS signing.`);
}
