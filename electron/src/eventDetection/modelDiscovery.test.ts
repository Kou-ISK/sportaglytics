import { createHash } from 'crypto';
import { mkdtemp, mkdir, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const electronMocks = vi.hoisted(() => ({
  appPath: '',
  userDataPath: '',
}));

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getAppPath: () => electronMocks.appPath,
    getPath: (name: string) => {
      if (name !== 'userData') throw new Error(`Unexpected app path: ${name}`);
      return electronMocks.userDataPath;
    },
  },
}));

interface MetricFixture {
  precision: number;
  recall: number;
  evaluatedMatches: number;
  confidenceThreshold: number;
}

interface ModelFixtureOptions {
  id?: string;
  status?: string;
  metric?: Partial<MetricFixture>;
  runnerPath?: string;
  runnerHash?: string;
  createRunner?: boolean;
}

const defaultMetric: MetricFixture = {
  precision: 0.2,
  recall: 0.96,
  evaluatedMatches: 5,
  confidenceThreshold: 0.5,
};

let testRoot = '';

const sha256 = (content: string): string =>
  createHash('sha256').update(content).digest('hex');

const createModelFixture = async ({
  id = 'model-a',
  status = 'verified',
  metric = {},
  runnerPath = 'runner',
  runnerHash,
  createRunner = true,
}: ModelFixtureOptions = {}): Promise<void> => {
  const modelDirectory = path.join(
    electronMocks.appPath,
    'resources',
    'event-detection-models',
    id,
  );
  await mkdir(modelDirectory, { recursive: true });

  const runnerContent = '#!/bin/sh\nexit 0\n';
  if (createRunner && !runnerPath.startsWith('..')) {
    const absoluteRunnerPath = path.join(modelDirectory, runnerPath);
    await mkdir(path.dirname(absoluteRunnerPath), { recursive: true });
    await writeFile(absoluteRunnerPath, runnerContent, { mode: 0o755 });
  }

  const manifest = {
    schemaVersion: 1,
    id,
    version: '1.0.0',
    displayName: id,
    status,
    events: ['restart'],
    metrics: {
      restart: { ...defaultMetric, ...metric },
    },
    runners: {
      [`${process.platform}-${process.arch}`]: {
        path: runnerPath,
        sha256: runnerHash ?? sha256(runnerContent),
      },
    },
  };

  await writeFile(
    path.join(modelDirectory, 'manifest.json'),
    JSON.stringify(manifest),
    'utf-8',
  );
};

const listModels = async () => {
  const { listEventDetectionModels } = await import('./modelDiscovery');
  return listEventDetectionModels();
};

beforeEach(async () => {
  vi.resetModules();
  testRoot = await mkdtemp(path.join(tmpdir(), 'sportaglytics-model-test-'));
  electronMocks.appPath = path.join(testRoot, 'app');
  electronMocks.userDataPath = path.join(testRoot, 'user-data');
  await mkdir(electronMocks.userDataPath, { recursive: true });
});

afterEach(async () => {
  await rm(testRoot, { recursive: true, force: true });
});

describe('event detection model discovery', () => {
  it('keeps the verified quality gate unchanged', async () => {
    await createModelFixture({ id: 'verified-pass' });
    await createModelFixture({
      id: 'verified-fail',
      metric: { recall: 0.94, evaluatedMatches: 4 },
    });

    const models = await listModels();

    expect(models.map((model) => model.info.id)).toEqual(['verified-pass']);
    expect(models[0]?.info.status).toBe('verified');
  });

  it('allows a structurally valid experimental model below the verified gate', async () => {
    await createModelFixture({
      id: 'experimental',
      status: 'experimental',
      metric: {
        precision: 0.08,
        recall: 0.96,
        evaluatedMatches: 2,
        confidenceThreshold: 0.24,
      },
    });

    const models = await listModels();

    expect(models).toHaveLength(1);
    expect(models[0]?.info.status).toBe('experimental');
    expect(models[0]?.info.metrics.restart?.evaluatedMatches).toBe(2);
  });

  it('rejects experimental models with invalid metrics', async () => {
    await createModelFixture({
      status: 'experimental',
      metric: { precision: -0.1 },
    });

    expect(await listModels()).toEqual([]);
  });

  it('rejects an unknown model status', async () => {
    await createModelFixture({ status: 'beta' });

    expect(await listModels()).toEqual([]);
  });

  it('rejects a runner hash mismatch for experimental models', async () => {
    await createModelFixture({
      status: 'experimental',
      runnerHash: '0'.repeat(64),
    });

    expect(await listModels()).toEqual([]);
  });

  it('rejects runner path traversal', async () => {
    await createModelFixture({
      status: 'experimental',
      runnerPath: '../outside-runner',
      createRunner: false,
    });

    expect(await listModels()).toEqual([]);
  });

  it('ignores models without a runner for the current platform', async () => {
    const modelDirectory = path.join(
      electronMocks.appPath,
      'resources',
      'event-detection-models',
      'wrong-platform',
    );
    await mkdir(modelDirectory, { recursive: true });
    await writeFile(
      path.join(modelDirectory, 'manifest.json'),
      JSON.stringify({
        schemaVersion: 1,
        id: 'wrong-platform',
        version: '1.0.0',
        displayName: 'wrong-platform',
        status: 'experimental',
        events: ['restart'],
        metrics: { restart: defaultMetric },
        runners: {
          'unsupported-platform': {
            path: 'runner',
            sha256: '0'.repeat(64),
          },
        },
      }),
      'utf-8',
    );

    expect(await listModels()).toEqual([]);
  });

  it('ignores a model whose current-platform runner file is missing', async () => {
    await createModelFixture({
      status: 'experimental',
      createRunner: false,
    });

    expect(await listModels()).toEqual([]);
  });
});
