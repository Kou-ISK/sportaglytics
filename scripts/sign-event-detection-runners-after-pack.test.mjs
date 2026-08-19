import { createHash } from 'node:crypto';
import { chmod, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { signModelDirectory } from './sign-event-detection-runners-after-pack.mjs';

const roots = [];
afterAll(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
});

const sha256 = (data) => createHash('sha256').update(data).digest('hex');

const makeModel = async (runnerPath = 'runner/test-runner') => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'sportaglytics-sign-runner-'));
  roots.push(root);
  const modelDirectory = path.join(root, 'model');
  const executable = path.join(modelDirectory, runnerPath);
  await mkdir(path.dirname(executable), { recursive: true });
  await writeFile(executable, 'unsigned-runner');
  await chmod(executable, 0o755);
  await writeFile(
    path.join(modelDirectory, 'manifest.json'),
    `${JSON.stringify({
      schemaVersion: 1,
      id: 'test-model',
      version: '1',
      displayName: 'Test',
      status: 'experimental',
      events: ['restart'],
      metrics: {},
      runners: {
        'darwin-arm64': { path: runnerPath, sha256: sha256('unsigned-runner') },
      },
    }, null, 2)}\n`,
  );
  return { modelDirectory, executable };
};

describe('signModelDirectory', () => {
  it('stores the SHA-256 of the runner after signing', async () => {
    const { modelDirectory, executable } = await makeModel();
    const signed = await signModelDirectory({
      modelDirectory,
      signing: { identityName: 'Test Identity', keychainFile: null },
      entitlementsPath: null,
      signRunnerImpl: async ({ runnerPath }) => {
        await writeFile(runnerPath, 'signed-runner');
      },
    });

    expect(signed).toBe(true);
    const manifest = JSON.parse(await readFile(path.join(modelDirectory, 'manifest.json'), 'utf8'));
    expect(manifest.runners['darwin-arm64'].sha256).toBe(sha256('signed-runner'));
    expect(await readFile(executable, 'utf8')).toBe('signed-runner');
  });

  it('rejects runner paths outside the model directory', async () => {
    const { modelDirectory } = await makeModel('../outside-runner');
    await expect(
      signModelDirectory({
        modelDirectory,
        signing: { identityName: 'Test Identity', keychainFile: null },
        entitlementsPath: null,
        signRunnerImpl: async () => {},
      }),
    ).rejects.toThrow('runner escapes model directory');
  });
});
