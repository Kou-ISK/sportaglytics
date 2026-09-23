import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type {
  CaptureSnapshot,
  CaptureStartRequest,
} from '../../../src/types/liveCapture';
import { registerPackageLocation } from '../mediaReferences/packageLocationRegistry';

export const createCapturePackage = async (
  directory: string,
): Promise<void> => {
  // Exclusive creation: selecting an existing document never overwrites it.
  await fs.mkdir(directory);
  await fs.mkdir(path.join(directory, '.metadata'));
  await fs.mkdir(path.join(directory, 'media'));
  await fs.writeFile(
    path.join(directory, '.metadata/package-id.json'),
    JSON.stringify({ version: 1, id: randomUUID() }),
    { flag: 'wx' },
  );
  await fs.writeFile(
    path.join(directory, 'timeline.json'),
    JSON.stringify({ version: 2, rows: [], instances: [] }),
    { flag: 'wx' },
  );
  await fs.writeFile(
    path.join(directory, '.metadata/config.json'),
    JSON.stringify({ angles: [] }),
    { flag: 'wx' },
  );
  await registerPackageLocation(directory).catch(() => undefined);
};

/** Called serially by the capture owner; Timeline edits remain in their own document. */
export const persistCapturePackage = async (
  snapshot: CaptureSnapshot,
  request: CaptureStartRequest,
): Promise<void> => {
  const configPath = path.join(snapshot.packagePath, '.metadata/config.json');
  const previous: unknown = JSON.parse(await fs.readFile(configPath, 'utf8'));
  const base =
    typeof previous === 'object' &&
    previous !== null &&
    !Array.isArray(previous)
      ? previous
      : {};
  const angles = snapshot.mediaAngles
    .filter((angle) => angle.clips.length > 0)
    .map((angle, index) => ({
      id: angle.id,
      playbackFormat: angle.playbackFormat,
      name: angle.name,
      role: index === 0 ? 'primary' : index === 1 ? 'secondary' : undefined,
      sourceKind: 'local',
      relativePath: angle.clips[0]
        ? path
            .relative(snapshot.packagePath, angle.clips[0].source)
            .split(path.sep)
            .join('/')
        : undefined,
      clips: angle.clips.map((clip) => ({
        id: clip.id,
        sourceKind: 'local',
        relativePath: path
          .relative(snapshot.packagePath, clip.source)
          .split(path.sep)
          .join('/'),
        gapBeforeSeconds: 0,
        timelineStartSeconds: clip.timelineStartSeconds,
        durationSeconds: clip.durationSeconds,
      })),
    }));
  const config = {
    ...base,
    angles,
    syncData: {
      syncOffset: 0,
      isAnalyzed: true,
      angleOffsets: angles.map(() => 0),
    },
    primaryAngleId: angles[0]?.id,
    secondaryAngleId: angles[1]?.id,
    tightViewPath: angles[0]?.relativePath ?? '',
    wideViewPath: angles[1]?.relativePath ?? null,
    liveCapture: {
      version: 1,
      id: snapshot.id,
      name: request.name,
      phase: snapshot.phase,
    },
  };
  const temporary = `${configPath}.${snapshot.id}.tmp`;
  await fs.writeFile(temporary, JSON.stringify(config), 'utf8');
  await fs.rename(temporary, configPath);
};
