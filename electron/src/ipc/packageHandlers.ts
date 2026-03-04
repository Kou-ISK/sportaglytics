import * as fs from 'node:fs';
import * as path from 'node:path';
import type { PackageDatas } from '../../../src/renderer';
import { generateInfoPlist } from '../templates/InfoPlist';
import { registerHandleWithAliases } from './registerHandleWithAliases';

interface PackageAnglePayload {
  id: string;
  name: string;
  sourcePath: string;
  role?: 'primary' | 'secondary';
}

interface PackageMetaDataConfig extends Record<string, unknown> {
  tightViewPath?: string;
  wideViewPath?: string | null;
  team1Name?: string;
  team2Name?: string;
  actionList?: string[];
  primaryAngleId?: string;
  secondaryAngleId?: string;
  angles?: Array<{
    id: string;
    name: string;
    role?: 'primary' | 'secondary';
    relativePath: string;
  }>;
}

interface NormalizedAngle {
  id: string;
  name: string;
  role?: 'primary' | 'secondary';
  relativePath: string;
  absolutePath: string;
}

let isRegistered = false;

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

const createPackage = async (
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

  const metaDataConfig = (metaDataConfigInput ??
    {}) as PackageMetaDataConfig;
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

  fs.writeFile(path.join(newPackagePath, 'timeline.json'), '[]', (error) => {
    if (error) console.log(error);
  });

  fs.mkdirSync(path.join(newPackagePath, '.metadata'));
  metaDataConfig.tightViewPath =
    primaryAngle?.relativePath || `videos/${newFilePath} 寄り.mp4`;
  metaDataConfig.wideViewPath = secondaryAngle ? secondaryAngle.relativePath : null;
  metaDataConfig.angles = normalizedAngles.map(
    ({ absolutePath: _absolutePath, ...rest }) => rest,
  );
  metaDataConfig.primaryAngleId =
    metaDataConfig.primaryAngleId || primaryAngle?.id;
  metaDataConfig.secondaryAngleId =
    metaDataConfig.secondaryAngleId || secondaryAngle?.id;
  const metaDataText = JSON.stringify(metaDataConfig);
  fs.writeFile(
    path.join(newPackagePath, '.metadata', 'config.json'),
    metaDataText,
    (error) => {
      if (error) console.log(error);
    },
  );

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

  const packageDatas: PackageDatas = {
    timelinePath: path.join(newPackagePath, 'timeline.json'),
    tightViewPath:
      primaryAngle?.absolutePath ||
      path.join(videosDir, `${newFilePath} 寄り.mp4`),
    wideViewPath: secondaryAngle ? secondaryAngle.absolutePath : null,
    angles: normalizedAngles,
    metaDataConfigFilePath: path.join(newPackagePath, '.metadata', 'config.json'),
  };

  return packageDatas;
};

const convertConfigToRelativePath = async (
  packagePath: string,
): Promise<{
  success: boolean;
  config?: Record<string, unknown>;
  error?: string;
}> => {
  try {
    const configPath = path.join(packagePath, '.metadata', 'config.json');

    try {
      await fs.promises.access(configPath, fs.constants.F_OK);
    } catch {
      console.warn(
        `[convert-config-to-relative-path] config.json not found: ${configPath}`,
      );
      return {
        success: false,
        error: 'config.json not found',
      };
    }

    const raw = await fs.promises.readFile(configPath, 'utf-8');
    const config = JSON.parse(raw ?? '{}');

    const packageRoot = path.resolve(packagePath);
    const videosDir = path.join(packageRoot, 'videos');

    const ensureRelativeVideoPath = async (value: unknown) => {
      if (typeof value !== 'string' || value.trim() === '') {
        return value;
      }

      const normalized = path.normalize(value);
      const resolved = path.isAbsolute(normalized)
        ? normalized
        : path.resolve(packageRoot, normalized);

      const relativeFromPackage = path.relative(packageRoot, resolved);
      const isInsidePackage =
        relativeFromPackage &&
        !relativeFromPackage.startsWith('..') &&
        !path.isAbsolute(relativeFromPackage);

      if (isInsidePackage) {
        if (!resolved.startsWith(videosDir + path.sep)) {
          console.warn(
            `[convert-config] ${resolved} は videos フォルダ外です。構成を見直してください。`,
          );
        }
        return relativeFromPackage.replace(/\\/g, '/');
      }

      const baseName = path.basename(resolved);
      const directCandidate = path.join(videosDir, baseName);
      const tryCandidate = async (candidatePath: string) => {
        try {
          await fs.promises.access(candidatePath, fs.constants.F_OK);
          const relative = path.relative(packageRoot, candidatePath);
          console.warn(`[convert-config] ${resolved} を ${relative} に更新します`);
          return relative.replace(/\\/g, '/');
        } catch {
          return null;
        }
      };

      const directMatch = await tryCandidate(directCandidate);
      if (directMatch) {
        return directMatch;
      }

      try {
        const entries = await fs.promises.readdir(videosDir);
        const matched = entries.find(
          (entry) => entry.toLowerCase() === baseName.toLowerCase(),
        );
        if (matched) {
          const fallback = path.join(videosDir, matched);
          const relative = path.relative(packageRoot, fallback);
          console.warn(`[convert-config] ${resolved} を ${relative} に更新します`);
          return relative.replace(/\\/g, '/');
        }
      } catch (scanError) {
        console.debug('videosフォルダの走査に失敗:', scanError);
      }

      console.warn(
        `[convert-config] ${resolved} はパッケージ外のため絶対パスのまま保持します`,
      );
      return resolved.replace(/\\/g, '/');
    };

    if (config.tightViewPath) {
      const converted = await ensureRelativeVideoPath(config.tightViewPath);
      if (converted !== config.tightViewPath) {
        config.tightViewPath = converted;
        console.log('tightViewPathを更新:', converted);
      }
    }

    if (config.wideViewPath) {
      const converted = await ensureRelativeVideoPath(config.wideViewPath);
      if (converted !== config.wideViewPath) {
        config.wideViewPath = converted;
        console.log('wideViewPathを更新:', converted);
      }
    }

    await fs.promises.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');

    console.log('config.jsonを相対パスに変換しました:', configPath);
    return { success: true, config };
  } catch (error) {
    console.error('convert-config-to-relative-path error:', error);
    return { success: false, error: String(error) };
  }
};

export const registerPackageHandlers = (): void => {
  if (isRegistered) {
    return;
  }
  isRegistered = true;

  registerHandleWithAliases(
    'package:create',
    ['create-package'],
    async (
      _event,
      directoryName: string,
      packageName: string,
      angles: unknown,
      metaDataConfig: unknown,
    ) => {
      return createPackage(directoryName, packageName, angles, metaDataConfig);
    },
  );

  registerHandleWithAliases(
    'package:convert-config-to-relative-path',
    ['convert-config-to-relative-path'],
    async (_event, packagePath: string) => {
      return convertConfigToRelativePath(packagePath);
    },
  );
};
