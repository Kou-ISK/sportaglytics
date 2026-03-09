import * as fs from 'node:fs';
import * as path from 'node:path';
import type { PackageDatas } from '../../../src/renderer';
import { generateInfoPlist } from '../templates/InfoPlist';
import type {
  NormalizedAngle,
  PackageAnglePayload,
  PackageMetaDataConfig,
} from './packageTypes';

const ensureSafeName = (raw: string, index: number): string => {
  const fallback = `Angle ${index + 1}`;
  if (!raw || typeof raw !== 'string') return fallback;
  const trimmed = raw.trim();
  const sanitized = trimmed.replace(/[\\/:*?"<>|]/g, '_');
  return sanitized || fallback;
};

const normalizeAngles = (
  angles: unknown,
  newFilePath: string,
  videosDir: string,
): NormalizedAngle[] => {
  return (Array.isArray(angles) ? angles : []).map((angle, index) => {
    const typedAngle = angle as Partial<PackageAnglePayload>;
    const name = ensureSafeName(typedAngle.name ?? '', index);
    const sourcePath =
      typeof typedAngle.sourcePath === 'string' ? typedAngle.sourcePath : '';
    if (!sourcePath) {
      throw new Error(`Invalid source path for angle "${name}"`);
    }
    const ext = path.extname(sourcePath) || '.mp4';
    const fileName = `${newFilePath} ${name}${ext}`;
    const relativePath = `videos/${fileName}`;
    const absolutePath = path.join(videosDir, fileName);
    fs.renameSync(sourcePath, absolutePath);
    return {
      id: String(typedAngle.id ?? `angle-${index + 1}`),
      name,
      role: typedAngle.role,
      relativePath,
      absolutePath,
    };
  });
};

const resolvePrimaryAndSecondaryAngles = (
  normalizedAngles: NormalizedAngle[],
  metaDataConfig: PackageMetaDataConfig,
) => {
  const primaryAngle =
    normalizedAngles.find((angle) => angle.id === metaDataConfig.primaryAngleId) ||
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

  await fs.promises.writeFile(path.join(newPackagePath, 'timeline.json'), '[]', 'utf-8');

  fs.mkdirSync(path.join(newPackagePath, '.metadata'));
  metaDataConfig.tightViewPath =
    primaryAngle?.relativePath || `videos/${newFilePath} 寄り.mp4`;
  metaDataConfig.wideViewPath = secondaryAngle ? secondaryAngle.relativePath : null;
  metaDataConfig.angles = normalizedAngles.map(
    ({ absolutePath: _absolutePath, ...rest }) => rest,
  );
  metaDataConfig.primaryAngleId = metaDataConfig.primaryAngleId || primaryAngle?.id;
  metaDataConfig.secondaryAngleId =
    metaDataConfig.secondaryAngleId || secondaryAngle?.id;

  const metaDataPath = path.join(newPackagePath, '.metadata', 'config.json');
  await fs.promises.writeFile(metaDataPath, JSON.stringify(metaDataConfig), 'utf-8');

  if (process.platform === 'darwin') {
    const infoPlist = generateInfoPlist({
      packageName: newFilePath,
      team1Name: metaDataConfig.team1Name ?? '',
      team2Name: metaDataConfig.team2Name ?? '',
      createdAt: new Date().toISOString(),
      version: '1.0',
    });
    fs.writeFileSync(path.join(newPackagePath, 'Info.plist'), infoPlist, 'utf-8');
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

  const newPackagePath = path.join(directoryName, packageBaseName);
  const newFilePath = packageBaseName.replace(/\.stpkg$/i, '');

  fs.mkdirSync(newPackagePath);
  const videosDir = path.join(newPackagePath, 'videos');
  fs.mkdirSync(videosDir);

  const normalizedAngles = normalizeAngles(angles, newFilePath, videosDir);
  if (normalizedAngles.length === 0) {
    throw new Error('No angles were provided for package creation.');
  }

  const metaDataConfig = (metaDataConfigInput ?? {}) as PackageMetaDataConfig;
  const { metaDataPath, primaryAngle, secondaryAngle } = await writePackageMetadata(
    newPackagePath,
    newFilePath,
    normalizedAngles,
    metaDataConfig,
  );

  return {
    timelinePath: path.join(newPackagePath, 'timeline.json'),
    tightViewPath:
      primaryAngle?.absolutePath ||
      path.join(videosDir, `${newFilePath} 寄り.mp4`),
    wideViewPath: secondaryAngle ? secondaryAngle.absolutePath : null,
    angles: normalizedAngles,
    metaDataConfigFilePath: metaDataPath,
  };
};
