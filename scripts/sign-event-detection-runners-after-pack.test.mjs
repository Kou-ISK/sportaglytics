import { createHash } from 'node:crypto';
import { chmod, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  selectDeveloperIdApplicationIdentity,
  signModelDirectory,
} from './sign-event-detection-runners-after-pack.mjs';

const roots = [];
afterAll(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
});

const sha256 = (data) => createHash('sha256').update(data).digest('hex');

const makeModel = async (runnerPath = 'runner/test-runner') => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'sportaglytics-sign-runner-'));
  roots.push(root);
  const modelDirectory = path.join(root, 'model');
  await mkdir(modelDirectory, { recursive: true });
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

describe('selectDeveloperIdApplicationIdentity', () => {
  const securityOutput = `
  1) AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA "Apple Development: Example User (TEAMAAAAAA)"
  2) BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB "Developer ID Application: Example User (TEAMBBBBBB)"
     2 valid identities found
`;

  it('selects a Developer ID Application identity', () => {
    expect(selectDeveloperIdApplicationIdentity(securityOutput)).toBe(
      'Developer ID Application: Example User (TEAMBBBBBB)',
    );
  });

  it('supports an explicit identity qualifier', () => {
    const output = `${securityOutput}  3) CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC "Developer ID Application: Other User (TEAMCCCCCC)"\n`;
    expect(selectDeveloperIdApplicationIdentity(output, 'TEAMCCCCCC')).toBe(
      'Developer ID Application: Other User (TEAMCCCCCC)',
    );
  });

  it('rejects ambiguous Developer ID Application identities', () => {
    const output = `${securityOutput}  3) CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC "Developer ID Application: Other User (TEAMCCCCCC)"\n`;
    expect(() => selectDeveloperIdApplicationIdentity(output)).toThrow(
      'multiple Developer ID Application identities are available',
    );
  });
});

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
