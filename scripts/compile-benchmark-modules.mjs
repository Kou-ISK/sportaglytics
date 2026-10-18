import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const projectRoot = fileURLToPath(new URL('..', import.meta.url));
export const benchmarkEntrypoints = {
  search:
    'src/features/videoPlayer/components/Timeline/VisualTimeline/review/timelineReviewSearch.ts',
  validation: 'src/shared/timeline/timelineValidation.ts',
  atomic: 'electron/src/ipc/atomicTextFile.ts',
};

/** Compile the real transitive graph before measurement; never duplicate domain logic. */
export const compileBenchmarkModules = async ({
  rootDirectory = projectRoot,
  parentDirectory = os.tmpdir(),
  entrypoints = benchmarkEntrypoints,
} = {}) => {
  const root = path.resolve(rootDirectory);
  const temporaryDirectory = await fs.mkdtemp(
    path.join(parentDirectory, 'sportaglytics-benchmark-modules-'),
  );
  const dispose = async () => {
    for (const filename of Object.keys(require.cache)) {
      if (filename.startsWith(`${temporaryDirectory}${path.sep}`))
        delete require.cache[filename];
    }
    await fs.rm(temporaryDirectory, { recursive: true, force: true });
  };
  try {
    const compilerVersion = require('typescript/package.json').version;
    // A child compiler keeps its heap/RSS and compilation time out of benchmark metrics.
    const output = execFileSync(
      process.execPath,
      [
        require.resolve('typescript/bin/tsc'),
        '--module',
        'commonjs',
        '--moduleResolution',
        'node',
        '--target',
        'ES2022',
        '--strict',
        '--esModuleInterop',
        '--skipLibCheck',
        '--noEmitOnError',
        '--types',
        'node',
        '--typeRoots',
        path.dirname(path.dirname(require.resolve('@types/node/package.json'))),
        '--pretty',
        'false',
        '--rootDir',
        root,
        '--outDir',
        temporaryDirectory,
        '--listFiles',
        ...Object.values(entrypoints).map((file) => path.resolve(root, file)),
      ],
      {
        cwd: root,
        encoding: 'utf8',
        maxBuffer: 8 * 1024 * 1024,
        timeout: 120000,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    await fs.writeFile(
      path.join(temporaryDirectory, 'package.json'),
      '{"type":"commonjs"}\n',
    );
    const sources = [
      ...new Set(
        output
          .split(/\r?\n/)
          .filter((file) => path.isAbsolute(file))
          .map((file) => path.relative(root, file))
          .filter(
            (file) =>
              !file.startsWith(`..${path.sep}`) &&
              !path.isAbsolute(file) &&
              !file.split(path.sep).includes('node_modules'),
          ),
      ),
    ]
      .sort()
      .map((file) => file.split(path.sep).join('/'));
    const modules = Object.fromEntries(
      Object.entries(entrypoints).map(([name, file]) => [
        name,
        require(
          path.resolve(temporaryDirectory, file.replace(/\.tsx?$/, '.js')),
        ),
      ]),
    );
    return { modules, sources, compilerVersion, temporaryDirectory, dispose };
  } catch (error) {
    await dispose();
    throw error;
  }
};
