import { app } from 'electron';
import { createHash } from 'crypto';
import { createReadStream } from 'fs';
import { access, readFile, readdir } from 'fs/promises';
import * as path from 'path';
import type {
  EventDetectionMetric,
  RugbyEventType,
} from '../../../src/types/eventDetection/core';
import { getVerifiedEventTypes } from '../../../src/shared/eventDetection/modelQualityGate';
import { isRugbyEventType } from '../../../src/types/ipc/eventDetection';
import { isPlainObject } from '../../../src/types/ipc/shared';
import type {
  EventDetectionModelManifest,
  EventDetectionRunnerManifest,
  VerifiedEventDetectionModel,
} from './types';

const MANIFEST_FILENAME = 'manifest.json';

const getPlatformRunnerKey = (): string => `${process.platform}-${process.arch}`;

const isMetric = (value: unknown): value is EventDetectionMetric => {
  if (!isPlainObject(value)) return false;
  return (
    typeof value.precision === 'number' &&
    Number.isFinite(value.precision) &&
    typeof value.recall === 'number' &&
    Number.isFinite(value.recall) &&
    typeof value.evaluatedMatches === 'number' &&
    Number.isInteger(value.evaluatedMatches) &&
    (value.timestampWithinTwoSecondsRate === undefined ||
      (typeof value.timestampWithinTwoSecondsRate === 'number' &&
        Number.isFinite(value.timestampWithinTwoSecondsRate)))
  );
};

const isRunnerManifest = (
  value: unknown,
): value is EventDetectionRunnerManifest => {
  return (
    isPlainObject(value) &&
    typeof value.path === 'string' &&
    value.path.length > 0 &&
    typeof value.sha256 === 'string' &&
    /^[a-f0-9]{64}$/i.test(value.sha256)
  );
};

const parseMetrics = (
  value: unknown,
): Partial<Record<RugbyEventType, EventDetectionMetric>> | null => {
  if (!isPlainObject(value)) return null;
  const metrics: Partial<Record<RugbyEventType, EventDetectionMetric>> = {};
  for (const [key, metric] of Object.entries(value)) {
    if (!isRugbyEventType(key) || !isMetric(metric)) return null;
    metrics[key] = metric;
  }
  return metrics;
};

const parseManifest = (value: unknown): EventDetectionModelManifest | null => {
  if (!isPlainObject(value)) return null;
  if (
    value.schemaVersion !== 1 ||
    typeof value.id !== 'string' ||
    !value.id.trim() ||
    typeof value.version !== 'string' ||
    !value.version.trim() ||
    typeof value.displayName !== 'string' ||
    !value.displayName.trim() ||
    (value.status !== 'verified' && value.status !== 'experimental') ||
    !Array.isArray(value.events) ||
    !value.events.every(isRugbyEventType) ||
    !isPlainObject(value.runners)
  ) {
    return null;
  }

  const metrics = parseMetrics(value.metrics);
  if (!metrics) return null;

  const runners: Record<string, EventDetectionRunnerManifest> = {};
  for (const [key, runner] of Object.entries(value.runners)) {
    if (!isRunnerManifest(runner)) return null;
    runners[key] = runner;
  }

  return {
    schemaVersion: 1,
    id: value.id,
    version: value.version,
    displayName: value.displayName,
    status: value.status,
    events: value.events,
    metrics,
    runners,
  };
};

const hashFile = (filePath: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });
};

const isPathInsideDirectory = (directory: string, filePath: string): boolean => {
  const relative = path.relative(directory, filePath);
  return relative.length > 0 && !relative.startsWith('..') && !path.isAbsolute(relative);
};

const getModelRoots = (): string[] => {
  const roots = [path.join(app.getPath('userData'), 'event-detection-models')];
  if (app.isPackaged) {
    roots.unshift(path.join(process.resourcesPath, 'event-detection-models'));
  } else {
    roots.unshift(path.join(app.getAppPath(), 'resources', 'event-detection-models'));
  }
  return roots;
};

const discoverModelDirectories = async (): Promise<string[]> => {
  const directories: string[] = [];
  for (const root of getModelRoots()) {
    try {
      const entries = await readdir(root, { withFileTypes: true });
      entries
        .filter((entry) => entry.isDirectory())
        .forEach((entry) => directories.push(path.join(root, entry.name)));
    } catch {
      // A missing model root simply means no models are installed there.
    }
  }
  return directories;
};

const loadVerifiedModel = async (
  modelDirectory: string,
): Promise<VerifiedEventDetectionModel | null> => {
  try {
    const raw = await readFile(path.join(modelDirectory, MANIFEST_FILENAME), 'utf-8');
    const manifest = parseManifest(JSON.parse(raw) as unknown);
    if (!manifest || manifest.status !== 'verified') return null;

    const verifiedEvents = getVerifiedEventTypes(manifest.events, manifest.metrics);
    if (verifiedEvents.length === 0) return null;

    const runner = manifest.runners[getPlatformRunnerKey()];
    if (!runner) return null;
    const runnerPath = path.resolve(modelDirectory, runner.path);
    if (!isPathInsideDirectory(modelDirectory, runnerPath)) return null;
    await access(runnerPath);

    const actualHash = await hashFile(runnerPath);
    if (actualHash.toLowerCase() !== runner.sha256.toLowerCase()) return null;

    const metrics: Partial<Record<RugbyEventType, EventDetectionMetric>> = {};
    verifiedEvents.forEach((eventType) => {
      const metric = manifest.metrics[eventType];
      if (metric) metrics[eventType] = metric;
    });

    return {
      info: {
        id: manifest.id,
        version: manifest.version,
        displayName: manifest.displayName,
        events: verifiedEvents,
        status: 'verified',
        metrics,
      },
      modelDirectory,
      runnerPath,
      runnerSha256: runner.sha256,
    };
  } catch {
    return null;
  }
};

export const listVerifiedEventDetectionModels = async (): Promise<
  VerifiedEventDetectionModel[]
> => {
  const directories = await discoverModelDirectories();
  const models = await Promise.all(directories.map(loadVerifiedModel));
  return models
    .filter((model): model is VerifiedEventDetectionModel => model !== null)
    .sort((left, right) => left.info.displayName.localeCompare(right.info.displayName));
};

export const findVerifiedEventDetectionModel = async (
  modelId: string,
  modelVersion: string,
): Promise<VerifiedEventDetectionModel | null> => {
  const models = await listVerifiedEventDetectionModels();
  return (
    models.find(
      (model) =>
        model.info.id === modelId && model.info.version === modelVersion,
    ) ?? null
  );
};
