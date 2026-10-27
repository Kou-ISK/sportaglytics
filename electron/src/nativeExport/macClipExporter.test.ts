// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { createMacClipExporter } from './macClipExporter';
import { NativeExportCancelled } from './nativeExportProcess';
import type { NativeClipExportRequest } from './nativeClipExport';
vi.mock('node:fs/promises', async (original) => {
  const actual = await original<typeof import('node:fs/promises')>();
  return { ...actual, copyFile: vi.fn(actual.copyFile) };
});
const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((p) => fs.rm(p, { recursive: true, force: true })),
  );
  vi.restoreAllMocks();
});
const setup = async (): Promise<NativeClipExportRequest> => {
  vi.spyOn(process, 'platform', 'get').mockReturnValue('darwin');
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'native-export-test-'));
  directories.push(dir);
  const sourcePath = path.join(dir, 'source.mp4');
  await fs.writeFile(sourcePath, 'original');
  return {
    sourcePath,
    outputPath: path.join(dir, 'out.mp4'),
    start: 2,
    duration: 3,
    audioTrack: 2,
  };
};
const completed = async (
  _binary: string,
  manifest: string,
): Promise<string> => {
  const request = JSON.parse(await fs.readFile(manifest, 'utf8'));
  await fs.writeFile(request.output, 'candidate');
  return JSON.stringify({
    version: 1,
    status: 'completed',
    duration: 3,
    audioTrack: 2,
  });
};
it('publishes only after independent admission, retains source, and removes staging', async () => {
  const request = await setup();
  let staging = '';
  const qualify = vi.fn(async (candidate: string) => {
    staging = path.dirname(candidate);
    return true;
  });
  expect(
    await createMacClipExporter({
      executable: 'helper',
      run: completed,
      qualify,
    })(request),
  ).toEqual({ status: 'completed' });
  expect(await fs.readFile(request.sourcePath, 'utf8')).toBe('original');
  expect(await fs.readFile(request.outputPath, 'utf8')).toBe('candidate');
  expect(qualify).toHaveBeenCalledOnce();
  await expect(fs.stat(staging)).rejects.toThrow();
});
it('completion alone cannot publish', async () => {
  const request = await setup();
  expect(
    await createMacClipExporter({
      executable: 'helper',
      run: completed,
      qualify: async () => false,
    })(request),
  ).toEqual({ status: 'fallback', reason: 'output-unqualified' });
  await expect(fs.stat(request.outputPath)).rejects.toThrow();
});
it('never overwrites a destination after qualification', async () => {
  const request = await setup();
  await fs.writeFile(request.outputPath, 'existing');
  await expect(
    createMacClipExporter({
      executable: 'helper',
      run: completed,
      qualify: async () => true,
    })(request),
  ).rejects.toThrow();
  expect(await fs.readFile(request.outputPath, 'utf8')).toBe('existing');
});
it.each(['reject', 'complete'])(
  'source replacement during helper %s is fatal, not fallback',
  async (mode) => {
    const request = await setup();
    const qualify = vi.fn(async () => true);
    const run = async (binary: string, manifest: string): Promise<string> => {
      await fs.writeFile(request.sourcePath, 'replacement');
      if (mode === 'reject') throw Error('native failed');
      return completed(binary, manifest);
    };
    await expect(
      createMacClipExporter({ executable: 'helper', run, qualify })(request),
    ).rejects.toThrow('source changed');
    expect(qualify).not.toHaveBeenCalled();
    await expect(fs.stat(request.outputPath)).rejects.toThrow();
  },
);
it.each([
  null,
  { version: 1, status: 'completed', duration: 3.2, audioTrack: 2 },
  { version: 1, status: 'completed', duration: 3, audioTrack: 0 },
])('rejects missing or mismatched receipt', async (receipt) => {
  const request = await setup();
  const qualify = vi.fn(async () => true);
  expect(
    (
      await createMacClipExporter({
        executable: 'helper',
        run: async () => JSON.stringify(receipt),
        qualify,
      })(request)
    ).status,
  ).toBe('fallback');
  expect(qualify).not.toHaveBeenCalled();
});
it.each([true, false])(
  'rejects source mutation during admission %s before publication or fallback',
  async (admitted) => {
    const request = await setup();
    await expect(
      createMacClipExporter({
        executable: 'helper',
        run: completed,
        qualify: async () => {
          await fs.writeFile(request.sourcePath, 'changed');
          return admitted;
        },
      })(request),
    ).rejects.toThrow('source changed');
    await expect(fs.stat(request.outputPath)).rejects.toThrow();
  },
);

it.each(['missing', 'probe-error'])(
  'falls back after an unqualified %s candidate while preserving source and destination',
  async (mode) => {
    const request = await setup();
    const result = await createMacClipExporter({
      executable: 'helper',
      run: async (binary, manifest) => {
        const receipt = await completed(binary, manifest);
        if (mode === 'missing') {
          const value = JSON.parse(await fs.readFile(manifest, 'utf8'));
          await fs.unlink(value.output);
        }
        return receipt;
      },
      qualify: async () => {
        throw Error('probe unavailable');
      },
    })(request);
    expect(result).toEqual({
      status: 'fallback',
      reason: 'output-unqualified',
    });
    expect(await fs.readFile(request.sourcePath, 'utf8')).toBe('original');
    await expect(fs.stat(request.outputPath)).rejects.toThrow();
  },
);
it('never falls back or publishes after cancellation during admission', async () => {
  const request = await setup(),
    controller = new AbortController();
  await expect(
    createMacClipExporter({
      executable: 'helper',
      run: completed,
      qualify: async () => {
        controller.abort();
        return true;
      },
    })({ ...request, signal: controller.signal }),
  ).rejects.toBeInstanceOf(NativeExportCancelled);
  await expect(fs.stat(request.outputPath)).rejects.toThrow();
});
it('does not expose a partial final file when cancelled during publication copy', async () => {
  const request = await setup(),
    controller = new AbortController();
  const actual =
    await vi.importActual<typeof import('node:fs/promises')>(
      'node:fs/promises',
    );
  vi.mocked(fs.copyFile).mockImplementationOnce(async (...args) => {
    await actual.copyFile(...args);
    controller.abort();
  });
  await expect(
    createMacClipExporter({
      executable: 'helper',
      run: completed,
      qualify: async () => true,
    })({ ...request, signal: controller.signal }),
  ).rejects.toBeInstanceOf(NativeExportCancelled);
  await expect(fs.stat(request.outputPath)).rejects.toThrow();
  expect((await fs.readdir(path.dirname(request.sourcePath))).sort()).toEqual([
    'source.mp4',
  ]);
});
it('rejects cancellation before starting the helper', async () => {
  const request = await setup(),
    controller = new AbortController();
  controller.abort();
  const run = vi.fn(completed);
  await expect(
    createMacClipExporter({
      executable: 'helper',
      run,
      qualify: async () => true,
    })({ ...request, signal: controller.signal }),
  ).rejects.toBeInstanceOf(NativeExportCancelled);
  expect(run).not.toHaveBeenCalled();
});
it('keeps non-local and symlink sources on the existing export path', async () => {
  const request = await setup(),
    run = vi.fn(completed);
  const exporter = createMacClipExporter({
    executable: 'helper',
    run,
    qualify: async () => true,
  });
  expect(
    await exporter({
      ...request,
      sourcePath: 'https://example.invalid/clip.mp4',
    }),
  ).toEqual({ status: 'fallback', reason: 'non-local-source' });
  const link = path.join(path.dirname(request.sourcePath), 'reference.mp4');
  await fs.symlink(request.sourcePath, link);
  expect(await exporter({ ...request, sourcePath: link })).toEqual({
    status: 'fallback',
    reason: 'unsupported-source-type',
  });
  expect(run).not.toHaveBeenCalled();
});
