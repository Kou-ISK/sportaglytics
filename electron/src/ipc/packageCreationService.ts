import * as fs from 'node:fs';
import * as path from 'node:path';
import type { PackageDatas } from '../../../src/renderer';
import { generateInfoPlist } from '../templates/InfoPlist';
import type {
  NormalizedAngle,
  PackageAnglePayload,
  PackageClipPayload,
  PackageMetaDataConfig,
} from './packageTypes';
import { isPlainObject } from './ipcPayloadGuards';
import { materializePackageAngle } from './packageMediaCompositionService';

const ensureSafeName = (raw: string, index: number): string => {
  const fallback = `Angle ${index + 1}`;
  if (!raw || typeof raw !== 'string') return fallback;
  const trimmed = raw.trim();
  const sanitized = trimmed.replace(/[\\/:*?"<>|]/g, '_');
  return sanitized || fallback;
};

const normalizeAngleRole = (
  value: unknown,
): PackageAnglePayload['role'] | undefined => {
  return value === 'primary' || value === 'secondary' ? value : undefined;
};

const normalizeAnglePayloads = (angles: unknown): PackageAnglePayload[] =>
  (Array.isArray(angles) ? angles : []).map((angle, index) => {
    if (!isPlainObject(angle) || !Array.isArray(angle.clips)) {
      throw new Error(`Invalid angle payload at index ${index}`);
    }
    return {
      id: typeof angle.id === 'string' ? angle.id : `angle-${index + 1}`,
      name: ensureSafeName(
        typeof angle.name === 'string' ? angle.name : '',
        index,
      ),
      role: normalizeAngleRole(angle.role),
      clips: angle.clips.map((clip, clipIndex) => {
        if (!isPlainObject(clip)) {
          throw new Error(`Invalid clip payload at index ${clipIndex}`);
        }
        const sourceKind: PackageClipPayload['sourceKind'] =
          clip.sourceKind === 'youtube' ? 'youtube' : 'local';
        return {
          id:
            typeof clip.id === 'string'
              ? clip.id
              : `clip-${index + 1}-${clipIndex + 1}`,
          sourceKind,
          source: typeof clip.source === 'string' ? clip.source : '',
          gapBeforeSeconds:
            typeof clip.gapBeforeSeconds === 'number'
              ? clip.gapBeforeSeconds
              : 0,
          timelineStartSeconds:
            typeof clip.timelineStartSeconds === 'number'
              ? clip.timelineStartSeconds
              : undefined,
          durationSeconds:
            typeof clip.durationSeconds === 'number'
              ? clip.durationSeconds
              : undefined,
        };
      }),
    };
  });

const resolvePrimaryAndSecondaryAngles = (
  normalizedAngles: NormalizedAngle[],
  metaDataConfig: PackageMetaDataConfig,
) => {
  const primaryAngle =
    normalizedAngles.find(
      (angle) => angle.id === metaDataConfig.primaryAngleId,
    ) ||
    normalizedAngles.find((angle) => angle.role === 'primary') ||
    normalizedAngles[0];
  const secondaryAngle =
    normalizedAngles.find(
      (angle) =>
        angle.id === metaDataConfig.secondaryAngleId &&
        primaryAngle &&
        angle.id !== primaryAngle.id,
    ) ||
    normalizedAngles.find(
      (angle) =>
        angle.role === 'secondary' &&
        primaryAngle &&
        angle.id !== primaryAngle.id,
    );
  return { primaryAngle, secondaryAngle };
};

const writePackageMetadata = async (
  newPackagePath: string,
  newFilePath: string,
  normalizedAngles: NormalizedAngle[],
  metaDataConfig: PackageMetaDataConfig,
) => {
  const { primaryAngle, secondaryAngle } = resolvePrimaryAndSecondaryAngles(
    normalizedAngles,
    metaDataConfig,
  );

  await fs.promises.writeFile(
    path.join(newPackagePath, 'timeline.json'),
    '[]',
    'utf-8',
  );

  fs.mkdirSync(path.join(newPackagePath, '.metadata'));
  metaDataConfig.tightViewPath =
    primaryAngle?.relativePath || primaryAngle?.sourceUrl || '';
  metaDataConfig.wideViewPath = secondaryAngle
    ? secondaryAngle.relativePath || secondaryAngle.sourceUrl || null
    : null;
  metaDataConfig.angles = normalizedAngles.map((angle) => ({
    id: angle.id,
    name: angle.name,
    role: angle.role,
    relativePath: angle.relativePath,
    sourceKind: angle.sourceKind,
    sourceUrl: angle.sourceUrl,
    clips: angle.clips.map((clip) => ({
      id: clip.id,
      sourceKind: clip.sourceKind,
      relativePath: clip.relativePath,
      sourceUrl: clip.sourceUrl,
      gapBeforeSeconds: clip.gapBeforeSeconds,
      timelineStartSeconds: clip.timelineStartSeconds,
      durationSeconds: clip.durationSeconds,
    })),
  }));
  metaDataConfig.primaryAngleId =
    metaDataConfig.primaryAngleId || primaryAngle?.id;
  metaDataConfig.secondaryAngleId =
    metaDataConfig.secondaryAngleId || secondaryAngle?.id;

  const metaDataPath = path.join(newPackagePath, '.metadata', 'config.json');
  await fs.promises.writeFile(
    metaDataPath,
    JSON.stringify(metaDataConfig),
    'utf-8',
  );

  if (process.platform === 'darwin') {
    const infoPlist = generateInfoPlist({
      packageName: newFilePath,
      team1Name: metaDataConfig.team1Name ?? '',
      team2Name: metaDataConfig.team2Name ?? '',
      createdAt: new Date().toISOString(),
      version: '1.0',
    });
    fs.writeFileSync(
      path.join(newPackagePath, 'Info.plist'),
      infoPlist,
      'utf-8',
    );
  }

  const readme = `SporTagLytics Package
Package Name: ${newFilePath}
Created: ${new Date().toLocaleString()}

このパッケージを開くには SporTagLytics をご利用ください。
https://github.com/Kou-ISK/sportaglytics
`;
  fs.writeFileSync(path.join(newPackagePath, 'README.txt'), readme, 'utf-8');

  return {
    metaDataPath,
    primaryAngle,
    secondaryAngle,
  };
};

export const createPackage = async (
  directoryName: string,
  packageName: string,
  angles: unknown,
  metaDataConfigInput: unknown,
): Promise<PackageDatas> => {
  const packageBaseName = packageName.endsWith('.stpkg')
    ? packageName
    : `${packageName}.stpkg`;
  if (
    path.basename(packageBaseName) !== packageBaseName ||
    packageBaseName === '.stpkg' ||
    /[\\/:*?"<>|]/.test(packageBaseName)
  ) {
    throw new Error('Invalid package name.');
  }

  const newPackagePath = path.join(directoryName, packageBaseName);
  const newFilePath = packageBaseName.replace(/\.stpkg$/i, '');
  const anglePayloads = normalizeAnglePayloads(angles);
  if (anglePayloads.length === 0) {
    throw new Error('No angles were provided for package creation.');
  }
  fs.mkdirSync(newPackagePath);
  try {
    const videosDir = path.join(newPackagePath, 'videos');
    fs.mkdirSync(videosDir);
    const normalizedAngles: NormalizedAngle[] = [];
    for (const [index, angle] of anglePayloads.entries()) {
      normalizedAngles.push(
        await materializePackageAngle(angle, index, newFilePath, videosDir),
      );
    }

    const metaDataConfig: PackageMetaDataConfig = isPlainObject(
      metaDataConfigInput,
    )
      ? { ...metaDataConfigInput }
      : {};
    const { metaDataPath, primaryAngle, secondaryAngle } =
      await writePackageMetadata(
        newPackagePath,
        newFilePath,
        normalizedAngles,
        metaDataConfig,
      );

    return {
      timelinePath: path.join(newPackagePath, 'timeline.json'),
      tightViewPath: primaryAngle?.absolutePath || '',
      wideViewPath: secondaryAngle ? secondaryAngle.absolutePath : null,
      angles: normalizedAngles,
      metaDataConfigFilePath: metaDataPath,
    };
  } catch (error) {
    await fs.promises.rm(newPackagePath, { recursive: true, force: true });
    throw error;
  }
};
