// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { createMacClipExporter } from './macClipExporter';
import { NativeExportCancelled } from './nativeExportProcess';
import { nativeMinimumFreeBytes } from './nativeCapacityPolicy';
import { exportResourceContext } from '../ipc/exportResourceContext';
import { retainedFor } from '../ipc/exportRetainedRecords';
import { publishExportOutput } from '../ipc/exportOutputTransaction';
import type { NativeClipExportRequest } from './nativeClipExport';
import {
  IndeterminatePublicationError,
  publishExclusive,
} from '../ipc/exportExclusivePublish';
vi.mock('../ipc/exportExclusivePublish', async (original) => {
  const actual =
    await original<typeof import('../ipc/exportExclusivePublish')>();
  return { ...actual, publishExclusive: vi.fn(actual.publishExclusive) };
});
vi.mock('node:fs/promises', async (original) => {
  const actual = await original<typeof import('node:fs/promises')>();
  return { ...actual, copyFile: vi.fn(actual.copyFile), rm: vi.fn(actual.rm) };
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
it('uses version 2 only with an explicit validated resource budget', async () => {
  const request = await setup(); const controller = new AbortController(); let seen: Record<string, unknown> | undefined; let timeoutMs: number | undefined; let minimumFreeBytes: number | undefined;
  const run = vi.fn(async (_binary: string, manifest: string, options?: { timeoutMs?: number; minimumFreeBytes?: number }) => {
    seen = JSON.parse(await fs.readFile(manifest, 'utf8')) as Record<string, unknown>;
    timeoutMs = options?.timeoutMs;
    minimumFreeBytes = options?.minimumFreeBytes;
    await fs.writeFile(String(seen.output), 'candidate');
    return JSON.stringify({ version: 2, status: 'completed', duration: 3, audioTrack: 2 });
  });
  const resources = { signal: controller.signal, maxFileBytes: 20 * 1024 ** 3, minFreeBytes: nativeMinimumFreeBytes(17_353_045_534), check: async () => undefined };
  const exporter = createMacClipExporter({ executable: 'helper', run, qualify: async () => true, experimentalBudget: { maxBytes: 17_353_045_534, deadlineSeconds: 240 } });
  expect(await exportResourceContext.run(resources, () => exporter({ ...request, signal: controller.signal }))).toEqual({ status: 'completed' });
  expect(seen).toMatchObject({ version: 2, deadlineSeconds: 240, maxOutputBytes: 16 * 1024 ** 2 + 8 });
  expect(timeoutMs).toBe(250000);
  expect(minimumFreeBytes).toBe(nativeMinimumFreeBytes(17_353_045_534));
});
it('rejects experimental budgets without resources or above the resource threshold before starting the helper', async () => {
  const request = await setup(); const run = vi.fn(completed);
  const exporter = createMacClipExporter({ executable: 'helper', run, qualify: async () => true, experimentalBudget: { maxBytes: 1000, deadlineSeconds: 120 } });
  await expect(exporter(request)).rejects.toThrow('Invalid experimental native budget');
  const controller = new AbortController();
  await expect(exportResourceContext.run({ signal: controller.signal, maxFileBytes: 999, minFreeBytes: 30_000_000_000, check: async () => undefined }, () => exporter(request))).rejects.toThrow('Invalid experimental native budget');
  expect(run).not.toHaveBeenCalled();
});
it('passes a finite 17.35 GB budget for a sparse large input without allocating it', async () => {
  const request = await setup(); await fs.truncate(request.sourcePath, 20 * 1024 ** 3);
  const controller = new AbortController(); let maxOutputBytes = 0;
  const run = async (_binary: string, manifest: string): Promise<string> => { const item = JSON.parse(await fs.readFile(manifest, 'utf8')); maxOutputBytes = item.maxOutputBytes; await fs.writeFile(item.output, 'candidate'); return JSON.stringify({ version: 2, status: 'completed', duration: 3, audioTrack: 2 }); };
  const resources = { signal: controller.signal, maxFileBytes: 20 * 1024 ** 3, minFreeBytes: 30_000_000_000, check: async () => undefined };
  const exporter = createMacClipExporter({ executable: 'helper', run, qualify: async () => true, experimentalBudget: { maxBytes: 17_353_045_534, deadlineSeconds: 240 } });
  expect(await exportResourceContext.run(resources, () => exporter({ ...request, signal: controller.signal }))).toEqual({ status: 'completed' });
  expect(maxOutputBytes).toBe(17_353_045_534);
});
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
  await expect(createMacClipExporter({ executable: 'helper', run: async () => JSON.stringify(receipt), qualify })(request)).rejects.toMatchObject({ name: 'NativeExportUnknownFailure' });
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
  const error = await createMacClipExporter({
      executable: 'helper',
      run: completed,
      qualify: async () => true,
    })({ ...request, signal: controller.signal }).catch((reason: unknown) => reason);
  expect(error).toBeInstanceOf(NativeExportCancelled);
  await expect(fs.stat(request.outputPath)).rejects.toThrow();
  const retained = retainedFor(error).directories;
  expect(retained.map((entry) => entry.purpose)).toEqual(expect.arrayContaining(['native-temp', 'native-staging']));
  expect(await fs.readdir(path.dirname(request.sourcePath))).toContain(path.basename(retained.find((entry) => entry.purpose === 'native-staging')!.path));
  const nativeTemp = retained.find((entry) => entry.purpose === 'native-temp');
  if (nativeTemp) directories.push(nativeTemp.path);
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

it('preserves an indeterminate result even if native temporary cleanup fails', async () => {
  const request = await setup();
  const actual =
    await vi.importActual<typeof import('node:fs/promises')>(
      'node:fs/promises',
    );
  const failure = new IndeterminatePublicationError();
  vi.mocked(publishExclusive).mockRejectedValueOnce(failure);
  let retained = '';
  vi.mocked(fs.rm).mockImplementationOnce(async (name) => {
    retained = String(name);
    throw new Error('cleanup failure');
  });
  try {
    await expect(
      createMacClipExporter({
        executable: 'helper',
        run: completed,
        qualify: async () => true,
      })(request),
    ).rejects.toBeInstanceOf(IndeterminatePublicationError);
    expect(retained).toContain('sportaglytics-native-export-');
    expect(failure.retainedDirectories.map((record) => record.purpose)).toEqual(
      ['native-staging', 'native-temp'],
    );
    expect(failure.retainedDirectories[1].reason).toBe('cleanup-failed');
    const entries = await fs.readdir(path.dirname(request.sourcePath));
    expect(
      entries.some((name) => name.startsWith('.sportaglytics-export-')),
    ).toBe(true);
  } finally {
    if (retained) await actual.rm(retained, { recursive: true, force: true });
  }
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

it('does not fallback when the helper fails for an unknown reason', async () => {
  const request = await setup();
  const original = new Error('undetermined helper failure');
  let ownedDirectory = '';
  const run = vi.fn(async (_binary: string, manifest: string) => {
    ownedDirectory = path.dirname(manifest);
    throw original;
  });
  try {
    await expect(createMacClipExporter({ executable: 'helper', run, qualify: async () => true })(request)).rejects.toMatchObject({ name: 'NativeExportUnknownFailure', originalError: original });
    expect(await fs.stat(ownedDirectory)).toBeDefined();
    await expect(fs.stat(request.outputPath)).rejects.toThrow();
  } finally { if (ownedDirectory) await fs.rm(ownedDirectory, { recursive: true, force: true }); }
});

it('keeps native, copy and outer staging records on a partial copy failure', async () => {
  const request = await setup();
  const { ExportCopyIncomplete } = await import('../ipc/exportBoundedCopy');
  const { publishExportOutput } = await import('../ipc/exportOutputTransaction');
  const { retainedFor } = await import('../ipc/exportRetainedRecords');
  vi.mocked(fs.copyFile).mockImplementationOnce(async (_source, destination) => {
    if (typeof destination !== 'string') throw new Error('unexpected test path');
    await fs.writeFile(destination, 'partial');
    throw new ExportCopyIncomplete(new Error('disk full'), destination);
  });
  let failure: unknown;
  try {
    await publishExportOutput(request.outputPath, async (stage) => {
      await createMacClipExporter({ executable: 'helper', run: completed, qualify: async () => true })({ ...request, outputPath: stage });
    });
  } catch (error) { failure = error; }
  try {
    const records = retainedFor(failure).directories;
    expect(records.map((record) => record.purpose).sort()).toEqual(['final-staging', 'native-staging', 'native-temp']);
    expect(new Set(records.map((record) => record.id)).size).toBe(3);
  } finally {
    for (const record of retainedFor(failure).directories) if (record.purpose === 'native-temp') await fs.rm(record.path, { recursive: true, force: true });
  }
});
it.each(['missing', 'symlink'] as const)('does not fall back if an estimated source becomes %s', async (change) => {
  const request = await setup();
  await fs.unlink(request.sourcePath);
  if (change === 'symlink') await fs.symlink(request.outputPath, request.sourcePath);
  const exporter = createMacClipExporter({ executable: 'helper', qualify: async () => true, expectedSourceRevision: 'previous' });
  await expect(exporter(request)).rejects.toMatchObject({ name: 'NativeExportCapacityError' });
});
it('v2 stages beside the target and publishes the same inode without a copy', async () => {
  const request = await setup();
  const controller = new AbortController();
  let candidate = '';
  let inode = 0;
  const run = async (_binary: string, manifest: string): Promise<string> => {
    const item = JSON.parse(await fs.readFile(manifest, 'utf8'));
    candidate = item.output;
    await fs.writeFile(candidate, 'candidate');
    inode = (await fs.stat(candidate)).ino;
    return JSON.stringify({ version: 2, status: 'completed', duration: 3, audioTrack: 2 });
  };
  const resources = { signal: controller.signal, maxFileBytes: 2000, minFreeBytes: 30_000_000_000, check: async () => undefined };
  const exporter = createMacClipExporter({ executable: 'helper', run, qualify: async () => true, experimentalBudget: { maxBytes: 1000, deadlineSeconds: 120 } });
  await expect(exportResourceContext.run(resources, () => exporter({ ...request, signal: controller.signal }))).resolves.toEqual({ status: 'completed' });
  expect(path.dirname(path.dirname(candidate))).toBe(path.dirname(request.outputPath));
  expect((await fs.stat(request.outputPath)).ino).toBe(inode);
});
it('v2 never replaces an existing staging output', async () => {
  const request = await setup(); await fs.writeFile(request.outputPath, 'existing');
  const controller = new AbortController();
  const run = async (_binary: string, manifest: string): Promise<string> => { const item = JSON.parse(await fs.readFile(manifest, 'utf8')); await fs.writeFile(item.output, 'candidate'); return JSON.stringify({ version: 2, status: 'completed', duration: 3, audioTrack: 2 }); };
  const resources = { signal: controller.signal, maxFileBytes: 2000, minFreeBytes: 30_000_000_000, check: async () => undefined };
  const exporter = createMacClipExporter({ executable: 'helper', run, qualify: async () => true, experimentalBudget: { maxBytes: 1000, deadlineSeconds: 120 } });
  await expect(exportResourceContext.run(resources, () => exporter({ ...request, signal: controller.signal }))).rejects.toMatchObject({ code: 'EEXIST' });
  expect(await fs.readFile(request.outputPath, 'utf8')).toBe('existing');
});
it.each(['false', 'throw'] as const)('v2 retains the candidate when qualification returns %s', async (mode) => {
  const request = await setup(); const controller = new AbortController(); let candidate = '';
  const run = async (_binary: string, manifest: string): Promise<string> => { const item = JSON.parse(await fs.readFile(manifest, 'utf8')); candidate = item.output; await fs.writeFile(candidate, 'candidate'); return JSON.stringify({ version: 2, status: 'completed', duration: 3, audioTrack: 2 }); };
  const resources = { signal: controller.signal, maxFileBytes: 2000, minFreeBytes: 30_000_000_000, check: async () => undefined };
  const qualify = async (): Promise<boolean> => { if (mode === 'throw') throw new Error('probe failed'); return false; };
  const exporter = createMacClipExporter({ executable: 'helper', run, qualify, experimentalBudget: { maxBytes: 1000, deadlineSeconds: 120 } });
  const error: unknown = await exportResourceContext.run(resources, () => exporter({ ...request, signal: controller.signal })).catch((e: unknown) => e);
  expect(error).toMatchObject({ name: 'NativeExportUnknownFailure' });
  expect(retainedFor(error).directories.length).toBeGreaterThan(0);
  expect(await fs.readFile(candidate, 'utf8')).toBe('candidate');
  await expect(fs.lstat(request.outputPath)).rejects.toMatchObject({ code: 'ENOENT' });
});
it('v2 retains a candidate if publication outcome is unknown', async () => {
  const request = await setup(); const controller = new AbortController(); let candidate = '';
  const run = async (_binary: string, manifest: string): Promise<string> => { const item = JSON.parse(await fs.readFile(manifest, 'utf8')); candidate = item.output; await fs.writeFile(candidate, 'candidate'); return JSON.stringify({ version: 2, status: 'completed', duration: 3, audioTrack: 2 }); };
  vi.mocked(publishExclusive).mockRejectedValueOnce(new IndeterminatePublicationError());
  const resources = { signal: controller.signal, maxFileBytes: 2000, minFreeBytes: 30_000_000_000, check: async () => undefined };
  const exporter = createMacClipExporter({ executable: 'helper', run, qualify: async () => true, experimentalBudget: { maxBytes: 1000, deadlineSeconds: 120 } });
  await expect(exportResourceContext.run(resources, () => exporter({ ...request, signal: controller.signal }))).rejects.toBeInstanceOf(IndeterminatePublicationError);
  expect(await fs.readFile(candidate, 'utf8')).toBe('candidate');
  await expect(fs.lstat(request.outputPath)).rejects.toMatchObject({ code: 'ENOENT' });
});

it('v2 keeps both staging names when inner publish succeeds but its receipt is lost', async () => {
  const request = await setup(); const controller = new AbortController(); let staged = ''; let candidate = '';
  const run = async (_binary: string, manifest: string): Promise<string> => { const item = JSON.parse(await fs.readFile(manifest, 'utf8')); candidate = item.output; await fs.writeFile(candidate, 'candidate'); return JSON.stringify({ version: 2, status: 'completed', duration: 3, audioTrack: 2 }); };
  vi.mocked(publishExclusive).mockImplementationOnce(async (source, target) => { await fs.link(source, target); throw new IndeterminatePublicationError(); });
  const resources = { signal: controller.signal, maxFileBytes: 2000, minFreeBytes: 30_000_000_000, check: async () => undefined };
  const exporter = createMacClipExporter({ executable: 'helper', run, qualify: async () => true, experimentalBudget: { maxBytes: 1000, deadlineSeconds: 120 } });
  await expect(exportResourceContext.run(resources, () => publishExportOutput(request.outputPath, async (stage) => { staged = stage; await exporter({ ...request, outputPath: stage, signal: controller.signal }); }, controller.signal))).rejects.toBeInstanceOf(IndeterminatePublicationError);
  expect(await fs.readFile(candidate, 'utf8')).toBe('candidate');
  expect(await fs.readFile(staged, 'utf8')).toBe('candidate');
  await expect(fs.lstat(request.outputPath)).rejects.toMatchObject({ code: 'ENOENT' });
});

it.each(['no-audio', 'range-not-covered'])('accepts verified pre-output unsupported receipt for %s', async (reason) => {
  const request = await setup();
  const exporter = createMacClipExporter({ executable: 'helper', qualify: async () => true, run: async () => JSON.stringify({ version: 1, status: 'unsupported', reason }) });
  expect(await exporter(request)).toEqual({ status: 'fallback', reason: reason === 'no-audio' ? 'native-pre-output-unsupported' : 'native-range-not-covered' });
});

it('does not trust an unsupported receipt if a candidate already exists', async () => {
  const request = await setup();
  const exporter = createMacClipExporter({ executable: 'helper', qualify: async () => true, run: async (_binary, manifest) => {
    const payload = JSON.parse(await fs.readFile(manifest, 'utf8'));
    await fs.writeFile(payload.output, 'partial');
    return JSON.stringify({ version: 1, status: 'unsupported', reason: 'no-audio' });
  } });
  await expect(exporter(request)).rejects.toThrow('Unexpected candidate');
  await expect(fs.stat(request.outputPath)).rejects.toMatchObject({ code: 'ENOENT' });
});

it('rejects an unsupported receipt with an unknown reason or extra data', async () => {
  const request = await setup();
  for (const receipt of [
    { version: 1, status: 'unsupported', reason: 'unknown' },
    { version: 1, status: 'unsupported', reason: 'no-audio', extra: true },
  ]) {
    const exporter = createMacClipExporter({ executable: 'helper', qualify: async () => true, run: async () => JSON.stringify(receipt) });
    await expect(exporter(request)).rejects.toThrow('Invalid native export receipt');
  }
});
