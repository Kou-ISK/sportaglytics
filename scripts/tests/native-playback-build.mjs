import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  hashFiles,
  PAYLOAD_FILES,
  verifyNativeBuild,
} from '../native-playback/manifest.mjs';

async function fixture(callback) {
  const directory = await mkdtemp(join(tmpdir(), 'native-payload-test-'));
  const identity = { revision: 1, inputHashes: { 'Source.hpp': 'example' } };
  try {
    for (const file of PAYLOAD_FILES.filter((f) => f !== 'build.json')) {
      await mkdir(dirname(join(directory, file)), { recursive: true });
      await writeFile(join(directory, file), `synthetic ${file}`);
    }
    const files = await hashFiles(
      directory,
      PAYLOAD_FILES.filter((f) => f !== 'build.json'),
    );
    await writeFile(
      join(directory, 'build.json'),
      JSON.stringify({ identity, files }),
    );
    await callback(directory, identity);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
test('verified complete payload accepted, changed header/recipe identity rejected', () =>
  fixture(async (root, identity) => {
    await verifyNativeBuild(root, identity);
    await assert.rejects(
      verifyNativeBuild(root, { ...identity, revision: 2 }),
      /inputs changed/,
    );
  }));
test('changed binary rejected', () =>
  fixture(async (root, identity) => {
    await writeFile(
      join(root, 'NativeProductHost'),
      'tampered synthetic helper',
    );
    await assert.rejects(verifyNativeBuild(root, identity), /hash mismatch/);
  }));
test('changed license rejected', () =>
  fixture(async (root, identity) => {
    await writeFile(join(root, 'licenses/Node-LICENSE.txt'), 'wrong notice');
    await assert.rejects(verifyNativeBuild(root, identity), /hash mismatch/);
  }));
test('input lists reject traversal, absolute paths and duplicates', async () => {
  for (const files of [['../secret'], ['/secret'], ['x', 'x'], ['x\\y'], []])
    await assert.rejects(hashFiles('/not-read', files), /Unsafe native input/);
});
test('extra files and missing files are rejected, not admitted by directory prefix', () =>
  fixture(async (root, identity) => {
    await writeFile(join(root, 'licenses/unexpected.txt'), 'unexpected');
    await assert.rejects(verifyNativeBuild(root, identity), /file set/);
    await rm(join(root, 'licenses/unexpected.txt'));
    await rm(join(root, 'Receiver.node'));
    await assert.rejects(verifyNativeBuild(root, identity), /file set/);
  }));
test('symlink payload is rejected before hashing', () =>
  fixture(async (root, identity) => {
    await rm(join(root, 'Receiver.node'));
    await symlink('NativeProductHost', join(root, 'Receiver.node'));
    await assert.rejects(verifyNativeBuild(root, identity), /nonregular/);
  }));

test('export duration accepts half a video clock tick, rejects excess/coarse/invalid clocks', { skip: process.platform !== 'darwin' }, async () => {
  const { execFileSync } = await import('node:child_process');
  const { fileURLToPath } = await import('node:url');
  const root = await mkdtemp(join(tmpdir(), 'export-clock-test-'));
  try {
    const header = fileURLToPath(new URL('../../native/macos/playback/apple-export/AppleClipExport.hpp', import.meta.url));
    const source = join(root, 'clock.cpp');
    await writeFile(source, `#include "${header}"\n#include <cassert>\nint main() {\nassert(nativeExportDurationMatches(3.0+1.0/30000,3.0+0.6/30000,30000));\nassert(nativeExportDurationMatches(3.0+0.5/30000,3.0,30000));\nassert(!nativeExportDurationMatches(3.0+1.0/30000,3.0,30000));\nassert(!nativeExportDurationMatches(3.002,3.0,1));\nassert(!nativeExportDurationMatches(3.0,3.0,0));\nassert(!nativeExportDurationMatches(NAN,3.0,30000));\nassert(!nativeExportDurationMatches(3.0,INFINITY,30000));\n}\n`);
    const binary = join(root, 'clock');
    execFileSync('clang++', ['-std=c++17', source, '-o', binary]);
    execFileSync(binary);
  } finally { await rm(root, { recursive: true, force: true }); }
});
