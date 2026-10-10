import { readFile, readdir } from 'node:fs/promises';
import { dirname, join, parse, relative } from 'node:path';

// Use rendered modules rather than every package in the developer's pnpm store.
export const licenseInventory = (fileName = 'licenses/renderer.json') => ({
  name: 'sportaglytics-license-inventory',
  async generateBundle(_options, bundle) {
    const packages = new Map();
    const directoryNotices = new Map();
    const noticesIn = async (directory) => {
      if (!directoryNotices.has(directory)) {
        const files = (await readdir(directory, { withFileTypes: true }))
          .filter(
            (entry) =>
              entry.isFile() &&
              /^(licen[cs]e|copying|notice)([.-]|$)/i.test(entry.name),
          )
          .map((entry) => entry.name)
          .sort();
        directoryNotices.set(
          directory,
          await Promise.all(
            files.map(async (name) => ({
              file: join(directory, name),
              text: await readFile(join(directory, name), 'utf8'),
            })),
          ),
        );
      }
      return directoryNotices.get(directory);
    };
    for (const chunk of Object.values(bundle)) {
      if (chunk.type !== 'chunk') continue;
      for (const id of chunk.moduleIds) {
        if (id.startsWith('\0') || !id.includes('node_modules')) continue;
        let directory = dirname(id.split('?')[0]);
        const ancestors = [];
        while (directory !== parse(directory).root) {
          ancestors.push(directory);
          let metadata;
          try {
            metadata = JSON.parse(
              await readFile(join(directory, 'package.json'), 'utf8'),
            );
          } catch (error) {
            if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR')
              throw error;
          }
          if (metadata?.name && metadata.version) {
            const key = `${metadata.name}@${metadata.version}`;
            if (!packages.has(key)) {
              const rootNotices = await noticesIn(directory);
              // This npm tarball omits its own MIT text. Use its matching upstream tag.
              const supplemental =
                key === 'victory-vendor@37.3.6'
                  ? [
                      {
                        file: 'upstream-LICENSE.txt',
                        text: await readFile(
                          new URL(
                            '../resources/third-party/victory-vendor-37.3.6-LICENSE.txt',
                            import.meta.url,
                          ),
                          'utf8',
                        ),
                      },
                    ]
                  : [];
              if (key === 'videojs-youtube@3.0.1') {
                const source = await readFile(
                  join(directory, 'dist/Youtube.js'),
                  'utf8',
                );
                const header = source.match(
                  /^\/\* (The MIT License[\s\S]*?)\*\//,
                )?.[1];
                if (
                  !header ||
                  !header.includes('Permission is hereby granted') ||
                  !header.includes('THE SOFTWARE IS PROVIDED')
                )
                  throw new Error(
                    'Missing videojs-youtube embedded license header',
                  );
                supplemental.push({
                  file: 'dist/Youtube.js (license header)',
                  text: header.trim(),
                });
              }
              if (
                key === '@mediapipe/tasks-vision@0.10.21' &&
                rootNotices.length === 0
              ) {
                supplemental.push({
                  file: 'LICENSE.txt',
                  text: await readFile(
                    new URL(
                      '../resources/pitch-vision/LICENSE.txt',
                      import.meta.url,
                    ),
                    'utf8',
                  ),
                });
                supplemental.push({
                  file: 'NOTICE.md',
                  text: await readFile(
                    new URL(
                      '../resources/pitch-vision/NOTICE.md',
                      import.meta.url,
                    ),
                    'utf8',
                  ),
                });
              }
              if (
                !rootNotices.some(({ file }) =>
                  /^(licen[cs]e|copying)/i.test(relative(directory, file)),
                ) &&
                supplemental.length === 0
              )
                throw new Error(
                  `Missing license text for bundled dependency ${key}`,
                );
              packages.set(key, {
                name: metadata.name,
                version: metadata.version,
                license: metadata.license ?? 'UNKNOWN',
                notices: supplemental,
              });
            }
            const entry = packages.get(key);
            // Preserve license/NOTICE files alongside nested vendored modules too.
            for (const ancestor of ancestors) {
              for (const notice of await noticesIn(ancestor)) {
                const file = relative(directory, notice.file).replaceAll(
                  '\\',
                  '/',
                );
                if (!entry.notices.some((item) => item.file === file))
                  entry.notices.push({ file, text: notice.text });
              }
            }
            break;
          }
          directory = dirname(directory);
        }
      }
    }
    const inventory = [...packages.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, value]) => ({
        ...value,
        notices: value.notices.sort((a, b) => a.file.localeCompare(b.file)),
      }));
    this.emitFile({
      type: 'asset',
      fileName,
      source: JSON.stringify(inventory, null, 2) + '\n',
    });
  },
});
