import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createRequire } from 'node:module';
import { cp, lstat, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  PAYLOAD_FILES,
  verifyNativeBuild,
} from '../native-playback/manifest.mjs';
import { hashFile } from '../download-verified.mjs';
import { selectDeveloperIdApplicationIdentity } from '../sign-event-detection-runners-after-pack.mjs';
const execute = promisify(execFile);
const require = createRequire(import.meta.url);
export const signatureVerifier = (project) =>
  require(
    join(
      project,
      'build/electron/src/nativePlayback/runtime/nativeSignature.js',
    ),
  );
export function verifyNativeResourceSet(files, arch) {
  const expected =
    arch === 'arm64'
      ? PAYLOAD_FILES.map((file) => `native-playback/${file}`)
      : [];
  if (JSON.stringify([...files].sort()) !== JSON.stringify(expected))
    throw Error('Native standard package resource set mismatch');
}
export async function copyNativeResources(project, resources) {
  const source = join(project, '.cache/native-playback/darwin-arm64');
  const manifest = JSON.parse(
    await readFile(join(source, 'build.json'), 'utf8'),
  );
  await verifyNativeBuild(source, manifest.identity);
  const target = join(resources, 'native-playback');
  try {
    await lstat(target);
    throw Error('Native resources already exist');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  await cp(source, target, {
    recursive: true,
    errorOnExist: true,
    force: false,
  });
}
export async function signNativeResources(context) {
  const options = context.packager.platformSpecificBuildOptions;
  // Dedicated unsigned local package is allowed to build, but its normal
  // runtime cannot activate native playback without the signed contract.
  if (options.identity === null) return;
  if (options.sign) throw Error('Custom native signing is unsupported');
  const { keychainFile } = await context.packager.codeSigningInfo.value;
  const args = ['find-identity', '-v', '-p', 'codesigning'];
  if (keychainFile) args.push(keychainFile);
  const result = await execute('/usr/bin/security', args, {
    encoding: 'utf8',
    timeout: 15000,
    maxBuffer: 65536,
  });
  const identity = selectDeveloperIdApplicationIdentity(
    result.stdout,
    options.identity ?? process.env.CSC_NAME ?? null,
  );
  const team = identity.match(/\(([A-Z0-9]{10})\)$/)?.[1];
  if (!team) throw Error('Native signing team is unavailable');
  const resources = context.packager.getResourcesDir(context.appOutDir);
  const root = join(resources, 'native-playback');
  const file = join(root, 'build.json');
  const manifest = JSON.parse(await readFile(file, 'utf8'));
  await verifyNativeBuild(root, manifest.identity);
  const {
    NATIVE_BINARY_IDENTIFIERS,
    verifyNativeCodeSignature,
    parseNativeSigning,
  } = signatureVerifier(context.packager.projectDir);
  const files = {};
  for (const [name, identifier] of Object.entries(NATIVE_BINARY_IDENTIFIERS)) {
    const target = join(root, name);
    const signArgs = [
      '--force',
      '--sign',
      identity,
      '--timestamp',
      '--options',
      'runtime',
      '--identifier',
      identifier,
    ];
    if (keychainFile) signArgs.push('--keychain', keychainFile);
    signArgs.push(target);
    await execute('/usr/bin/codesign', signArgs, {
      encoding: 'utf8',
      timeout: 60000,
      maxBuffer: 65536,
    });
    await verifyNativeCodeSignature(target, identifier, team);
    files[name] = { identifier, sha256: await hashFile(target) };
  }
  manifest.signing = parseNativeSigning({ version: 1, teamId: team, files });
  // Inner code is final. Electron-builder signs the enclosing app after this.
  await writeFile(file, JSON.stringify(manifest, null, 2) + '\n');
}
