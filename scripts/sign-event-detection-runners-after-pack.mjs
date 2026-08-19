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

const resolveSigningContext = async (packager) => {
  const signConfig = packager.getPlatformConfig('mac').config.sign;
  if (signConfig === null) {
    throw new Error('event-detection model packs require macOS code signing');
  }
  if (typeof signConfig === 'string' || typeof signConfig === 'function') {
    throw new Error('custom macOS signing is not supported for event-detection model packs');
  }

  const signOptions = signConfig && typeof signConfig === 'object' ? signConfig : undefined;
  if (signOptions?.identity === null) {
    throw new Error('event-detection model packs require a macOS signing identity');
  }

  const signingInfo = await packager.codeSigningInfo.value;
  const keychainFile = signingInfo?.keychainFile ?? null;
  const identity = await packager.helper.findSigningIdentity(
    'mac',
    signOptions?.identity,
    keychainFile,
    false,
    signOptions,
  );
  if (!identity) {
    throw new Error('no Developer ID signing identity is available for event-detection runners');
  }

  return { identityName: identity.name, keychainFile };
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
