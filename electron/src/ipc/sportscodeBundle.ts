import fs from 'node:fs/promises';
import path from 'node:path';

interface BundleFiles {
  xml: string[];
  movies: string[];
}

/** Inventory only ordinary files in the selected package. Never follow links. */
export const listSportscodeBundleFiles = async (
  root: string,
): Promise<BundleFiles> => {
  const stat = await fs.lstat(root);
  if (!/\.scpkg$/i.test(root) || !stat.isDirectory() || stat.isSymbolicLink())
    throw new Error('フォルダ形式の.scpkgを選択してください。');
  const files: BundleFiles = { xml: [], movies: [] };
  const directories = [await fs.realpath(root)];
  let count = 0;
  for (const directory of directories) {
    for await (const entry of await fs.opendir(directory)) {
      if (++count > 4096)
        throw new Error(
          'パッケージの項目が多すぎます。XMLと映像を個別に選んでください。',
        );
      if (entry.name.startsWith('.') || entry.isSymbolicLink()) continue;
      const file = path.join(directory, entry.name);
      if (entry.isDirectory() && !/\.(scpkg|stpkg|app)$/i.test(entry.name))
        directories.push(file);
      if (!entry.isFile()) continue;
      if (/\.xml$/i.test(entry.name)) files.xml.push(file);
      if (/\.(mp4|mov|m4v|webm)$/i.test(entry.name)) files.movies.push(file);
    }
  }
  return files;
};
