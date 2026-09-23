import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';

const identityFile = (root: string): string =>
  path.join(root, '.metadata', 'package-id.json');
const isId = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-f0-9-]{36}$/i.test(value);

export const findMediaPackageRoot = (source: string): string | undefined => {
  const normalized = source.replace(/\\/g, '/');
  const match = normalized.match(/^(.*?\.stpkg)(?:\/|$)/i);
  return match?.[1];
};

export const readPackageIdentity = async (
  root: string,
): Promise<string | undefined> => {
  try {
    const value: unknown = JSON.parse(
      await fs.readFile(identityFile(root), 'utf8'),
    );
    if (value && typeof value === 'object' && 'id' in value && isId(value.id))
      return value.id;
  } catch {
    /* Missing or unreadable identity is not an identity match. */
  }
  return undefined;
};

export const ensurePackageIdentity = async (
  root: string,
): Promise<string | undefined> => {
  const existing = await readPackageIdentity(root);
  if (existing) return existing;
  try {
    // Only real application packages receive an identity; never create arbitrary folders.
    const config: unknown = JSON.parse(
      await fs.readFile(path.join(root, '.metadata', 'config.json'), 'utf8'),
    );
    if (!config || typeof config !== 'object' || Array.isArray(config))
      return undefined;
    const id = randomUUID();
    await fs.writeFile(identityFile(root), JSON.stringify({ id }), {
      flag: 'wx',
    });
    return id;
  } catch {
    // Covers another concurrent registration winning the exclusive create and read-only media.
    return readPackageIdentity(root);
  }
};

export const resolvePackageMember = (root: string, member: string): string => {
  if (!member || path.posix.isAbsolute(member) || path.win32.isAbsolute(member))
    throw new Error('INVALID_PACKAGE_MEDIA_PATH');
  const result = path.resolve(root, ...member.replace(/\\/g, '/').split('/'));
  const relative = path.relative(path.resolve(root), result);
  if (
    !relative ||
    relative === '..' ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  )
    throw new Error('INVALID_PACKAGE_MEDIA_PATH');
  return result;
};
