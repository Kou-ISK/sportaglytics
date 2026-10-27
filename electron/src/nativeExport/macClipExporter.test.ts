// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { createMacClipExporter } from './macClipExporter';
import type { NativeClipExportRequest } from './nativeClipExport';
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
