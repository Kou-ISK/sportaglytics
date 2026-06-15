import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ConvertConfigResult } from './packageTypes';

const toPosixPath = (value: string) => value.replace(/\\/g, '/');

const tryResolveRelativePath = async (
  packageRoot: string,
  videosDir: string,
  value: string,
): Promise<string> => {
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
    return toPosixPath(relativeFromPackage);
  }

  const baseName = path.basename(resolved);
  const directCandidate = path.join(videosDir, baseName);

  try {
    await fs.promises.access(directCandidate, fs.constants.F_OK);
    const relative = path.relative(packageRoot, directCandidate);
    console.warn(`[convert-config] ${resolved} を ${relative} に更新します`);
    return toPosixPath(relative);
  } catch {
    // noop
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
      return toPosixPath(relative);
    }
  } catch (scanError) {
    console.debug('videosフォルダの走査に失敗:', scanError);
  }

  console.warn(
    `[convert-config] ${resolved} はパッケージ外のため絶対パスのまま保持します`,
  );
  return toPosixPath(resolved);
};

const ensureRelativeVideoPath = async ({
  packageRoot,
  videosDir,
  value,
}: {
  packageRoot: string;
  videosDir: string;
  value: unknown;
}) => {
  if (typeof value !== 'string' || value.trim() === '') {
    return value;
  }
  return tryResolveRelativePath(packageRoot, videosDir, value);
};

export const convertConfigToRelativePath = async (
  packagePath: string,
): Promise<ConvertConfigResult> => {
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

    if (config.tightViewPath) {
      const converted = await ensureRelativeVideoPath({
        packageRoot,
        videosDir,
        value: config.tightViewPath,
      });
      if (converted !== config.tightViewPath) {
        config.tightViewPath = converted;
        console.log('tightViewPathを更新:', converted);
      }
    }

    if (config.wideViewPath) {
      const converted = await ensureRelativeVideoPath({
        packageRoot,
        videosDir,
        value: config.wideViewPath,
      });
      if (converted !== config.wideViewPath) {
        config.wideViewPath = converted;
        console.log('wideViewPathを更新:', converted);
      }
    }

    await fs.promises.writeFile(
      configPath,
      JSON.stringify(config, null, 2),
      'utf-8',
    );

    console.log('config.jsonを相対パスに変換しました:', configPath);
    return { success: true, config };
  } catch (error) {
    console.error('convert-config-to-relative-path error:', error);
    return { success: false, error: String(error) };
  }
};
