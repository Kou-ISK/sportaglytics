import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { app } from 'electron';
import {
  createMacFileBookmark,
  resolveMacFileBookmark,
} from './macFileBookmark';
import { ensurePackageIdentity, readPackageIdentity } from './packageIdentity';

interface Location {
  id: string;
  path: string;
  bookmark?: string;
}
const registryFile = (): string =>
  path.join(app.getPath('userData'), 'package-locations.json');
let writing: Promise<unknown> = Promise.resolve();

const readLocations = async (): Promise<Location[]> => {
  try {
    const data: unknown = JSON.parse(await fs.readFile(registryFile(), 'utf8'));
    if (!Array.isArray(data)) return [];
    return data.filter(
      (entry): entry is Location =>
        Boolean(entry) &&
        typeof entry === 'object' &&
        typeof entry.id === 'string' &&
        typeof entry.path === 'string' &&
        (entry.bookmark === undefined || typeof entry.bookmark === 'string'),
    );
  } catch {
    return [];
  }
};

/** Private machine-local location hints. No bookmarks are put in portable documents. */
export const registerPackageLocation = async (
  root: string,
): Promise<string | undefined> => {
  const id = await ensurePackageIdentity(root);
  if (!id) return undefined;
  const realPath = await fs.realpath(root).catch(() => undefined);
  if (!realPath) return undefined;
  const previous = (await readLocations()).find(
    (entry) => entry.id === id && entry.path === realPath,
  );
  if (previous?.bookmark || (previous && process.platform !== 'darwin'))
    return id;
  const bookmark = await createMacFileBookmark(realPath);
  const task = writing.then(async () => {
    const entries = (await readLocations()).filter((entry) => entry.id !== id);
    entries.push({ id, path: realPath, bookmark });
    const file = registryFile();
    await fs.mkdir(path.dirname(file), { recursive: true });
    const temporary = `${file}.tmp`;
    await fs.writeFile(temporary, JSON.stringify(entries.slice(-1000)), {
      mode: 0o600,
    });
    await fs.rename(temporary, file);
  });
  writing = task.catch(() => undefined);
  // A private cache write failure must not prevent opening a valid package.
  await writing;
  return id;
};

export const locateRegisteredPackage = async (
  id: string,
): Promise<string | undefined> => {
  const entry = (await readLocations()).find((item) => item.id === id);
  if (!entry) return undefined;
  if ((await readPackageIdentity(entry.path)) === id) return entry.path;
  const resolved = entry.bookmark
    ? await resolveMacFileBookmark(entry.bookmark)
    : undefined;
  if (resolved && (await readPackageIdentity(resolved)) === id) {
    await registerPackageLocation(resolved);
    return resolved;
  }
  return undefined;
};
