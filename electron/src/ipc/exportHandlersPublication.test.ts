// @vitest-environment node
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeAll, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  handlers: new Map<string, (...args: never[]) => Promise<unknown>>(),
  render: vi.fn(),
  concat: vi.fn(),
  progress: vi.fn(),
  quit: undefined as
    | ((event: { preventDefault: () => void }) => void)
    | undefined,
  appQuit: vi.fn(),
  dialog: vi.fn(),
  publishOverride: undefined as undefined | ((source: string, target: string) => Promise<void>),
  finishFailures: 0,
  cleanupNoticeFailures: 0,
  cleanupRecoveryFailures: 0,
  cancel: undefined as ((id: string) => string) | undefined,
  native: vi.fn(async (_request: { signal?: AbortSignal }) => ({
    status: 'fallback' as const,
    reason: 'native-unavailable',
  })),
}));
vi.mock('./exportShutdownCoordinator', async (original) => {
  const actual = await original<typeof import('./exportShutdownCoordinator')>();
  return { ...actual, createExportShutdownCoordinator: (...args: Parameters<typeof actual.createExportShutdownCoordinator>) => {
    const coordinator = actual.createExportShutdownCoordinator(...args);
    return { ...coordinator, start: (...startArgs: Parameters<typeof coordinator.start>) => {
      const job = coordinator.start(...startArgs);
      return { ...job, finishCommit: (final: boolean) => { if (mocks.finishFailures > 0) { mocks.finishFailures--; throw new Error('injected finish failure'); } job.finishCommit(final); } };
    } };
  } };
});
vi.mock('./exportExclusivePublish', async (original) => {
  const actual = await original<typeof import('./exportExclusivePublish')>();
  return { ...actual, publishExclusive: (source: string, target: string) => mocks.publishOverride ? mocks.publishOverride(source, target) : actual.publishExclusive(source, target) };
});
vi.mock('./exportOutputTransaction', async (original) => {
  const actual = await original<typeof import('./exportOutputTransaction')>();
  return { ...actual, publishExportOutput: (...args: Parameters<typeof actual.publishExportOutput>) => {
    const [output, render, signal, commit, publish] = args;
    if (mocks.cleanupNoticeFailures > 0 && commit) {
      mocks.cleanupNoticeFailures--;
      return actual.publishExportOutput(output, render, signal, {
        ...commit,
        cleanupFailed: () => { throw new Error('injected cleanup notice failure'); },
        cleanupNotificationFailed: () => {
          if (mocks.cleanupRecoveryFailures > 0) { mocks.cleanupRecoveryFailures--; throw new Error('injected cleanup recovery failure'); }
          commit.cleanupNotificationFailed?.();
        },
      }, publish);
    }
    return actual.publishExportOutput(...args);
  } };
});
vi.mock('electron', () => ({
  app: {
    on: (
      _event: string,
      handler: (event: { preventDefault: () => void }) => void,
    ) => {
      mocks.quit = handler;
    },
    quit: mocks.appQuit,
  },
  ipcMain: {
    handle: (name: string, handler: (...args: never[]) => Promise<unknown>) =>
      mocks.handlers.set(name, handler),
  },
  BrowserWindow: { fromWebContents: () => null },
  dialog: { showOpenDialog: mocks.dialog },
}));
vi.mock('./windowSenderGuards', () => ({
  getValidatedEventSenderWindow: () => ({}),
}));
vi.mock('./exportTextPreview', () => ({
  registerExportTextPreview: () => undefined,
}));
vi.mock('./exportTextInspection', () => ({
  assertExportTextFits: async () => undefined,
}));
vi.mock('./exportPreflight', () => ({ preflightClipExport: async () => [] }));
vi.mock('./exportSourcePreparation', () => ({
  buildExportPreparationJobs: () => [],
  prepareExportSources: async () => new Map(),
}));
vi.mock('./exportClipRender', () => ({ renderClipWithFfmpeg: mocks.render }));
vi.mock('./exportFfmpegRunners', () => ({ concatFiles: mocks.concat }));
vi.mock('../exportProgressWindow', () => ({
  updateExportProgressWindow: mocks.progress,
  openExportProgressWindow: async () => undefined,
  setExportCancelHandler: (handler: (id: string) => string) => {
    mocks.cancel = handler;
  },
}));

import { registerExportHandlers } from './exportHandlers';
import { IndeterminatePublicationError } from './exportExclusivePublish';
import { rememberRetained } from './exportRetainedRecords';
import { FfmpegExecutionError } from './exportFfmpegProcess';
const roots: string[] = [];
beforeAll(() =>
  registerExportHandlers({
    getMainWindow: () => null,
    getFfmpegPath: () => 'ffmpeg',
    nativeClipExporter: mocks.native,
  }),
);
afterEach(async () => {
  vi.unstubAllGlobals();
  mocks.render.mockReset();
  mocks.concat.mockReset();
  mocks.progress.mockReset();
  mocks.native.mockClear();
  mocks.publishOverride = undefined;
  mocks.finishFailures = 0;
  mocks.cleanupNoticeFailures = 0;
  mocks.cleanupRecoveryFailures = 0;
  await Promise.all(
    roots
      .splice(0)
      .map((root) => fs.rm(root, { recursive: true, force: true })),
  );
});

it.each(['with-id', 'without-id'])('preserves saved success when the cleanup notification callback fails (%s)', async (variant) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'export-notice-recovery-')); roots.push(root);
  mocks.cleanupNoticeFailures = 1;
  mocks.native.mockImplementationOnce(async (request: { outputPath: string }) => {
    await fs.writeFile(request.outputPath, 'complete');
    return { status: 'completed' as const };
  });
  mocks.publishOverride = async (source, target) => {
    await fs.link(source, target);
    await fs.writeFile(path.join(path.dirname(source), 'unexpected'), 'fixture');
  };
  const handler = mocks.handlers.get('export-clips-with-overlay'); if (!handler) throw new Error('handler missing');
  const result = await handler({} as never, { sourcePath: '/synthetic.mp4', outputDir: root, exportMode: 'perInstance', ...(variant === 'with-id' ? { progressId: 'notice-recovery' } : {}), clips: [{ id: 'one', actionName: 'A', startTime: 1, endTime: 3 }], overlay: { enabled: false, showActionName: false, showActionIndex: false, showLabels: false, showMemo: false } } as never);
  const output = path.join(root, '001_A_angle1.mp4');
  expect(result).toMatchObject({ success: true, publishedOutputs: [output], cleanupWarning: expect.stringContaining('保存されました'), retainedLocationUnknown: true });
  expect(await fs.readFile(output, 'utf8')).toBe('complete');
  expect(mocks.progress.mock.calls.some(([value]) => (value as { retainedLocationUnknown?: boolean }).retainedLocationUnknown === true)).toBe(true);
});

it.each(['with-id', 'without-id'])('reports the saved output and unknown retention when notification recovery also fails (%s)', async (variant) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'export-notice-double-failure-')); roots.push(root);
  mocks.cleanupNoticeFailures = 1; mocks.cleanupRecoveryFailures = 1;
  mocks.native.mockImplementationOnce(async (request: { outputPath: string }) => {
    await fs.writeFile(request.outputPath, 'complete');
    return { status: 'completed' as const };
  });
  mocks.publishOverride = async (source, target) => {
    await fs.link(source, target);
    await fs.writeFile(path.join(path.dirname(source), 'unexpected'), 'fixture');
  };
  const handler = mocks.handlers.get('export-clips-with-overlay'); if (!handler) throw new Error('handler missing');
  const result = await handler({} as never, { sourcePath: '/synthetic.mp4', outputDir: root, exportMode: 'perInstance', ...(variant === 'with-id' ? { progressId: 'notice-double-failure' } : {}), clips: [{ id: 'one', actionName: 'A', startTime: 1, endTime: 3 }], overlay: { enabled: false, showActionName: false, showActionIndex: false, showLabels: false, showMemo: false } } as never);
  const output = path.join(root, '001_A_angle1.mp4');
  expect(result).toMatchObject({ success: false, error: expect.stringContaining('保存'), publishedOutputs: [output], retainedLocationUnknown: true });
  expect(await fs.readFile(output, 'utf8')).toBe('complete');
  expect(mocks.progress.mock.calls.some(([value]) => (value as { retainedLocationUnknown?: boolean }).retainedLocationUnknown === true)).toBe(true);
});

it('reports VideoToolbox failure through Main progress and result without diagnostic paths', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'export-vt-message-'));
  roots.push(root);
  const failure = new FfmpegExecutionError({
    exitCode: 187, signal: null,
    stderrTail: '[h264_videotoolbox @ 0x123] Error: cannot create compression session: -12908\n/private/source-secret.mp4',
    executablePath: '/private/ffmpeg', commandSummary: 'ffmpeg -i <value>', videoToolboxRequested: true,
  });
  mocks.render.mockRejectedValue(failure);
  const handler = mocks.handlers.get('export-clips-with-overlay');
  if (!handler) throw new Error('handler missing');
  const result = await handler({} as never, {
    sourcePath: '/synthetic.mp4', outputDir: root, exportMode: 'single', progressId: 'test-vt',
    clips: [{ id: 'one', actionName: 'First', startTime: 1, endTime: 3 }],
    overlay: { enabled: false, showActionName: false, showActionIndex: false, showLabels: false, showMemo: false },
  } as never);
  expect(result).toMatchObject({ success: false, error: expect.stringContaining('-12908') });
  const failed = mocks.progress.mock.calls.map(([value]) => value as { status?: string; error?: string }).find((value) => value.status === 'failed');
  expect(failed?.error).toContain('H.264 エンコーダーを利用できない');
  expect(JSON.stringify({ result, failed })).not.toContain('/private/');
  expect(failure.details.stderrTail).toContain('/private/source-secret.mp4');
  expect((await fs.readdir(root)).filter((name) => name.endsWith('.mp4'))).toHaveLength(0);
});

it.each(['darwin', 'win32'])('does not report completion when final publication collides on %s', async (platform) => {
  vi.stubGlobal('process', { ...process, platform });
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), 'export-ipc-collision-'),
  );
  roots.push(root);
  const output = path.join(root, 'combined_1_angle1.mp4');
  mocks.render.mockImplementation(async (request: { tempFiles: string[]; outputPath?: string }) => {
    const temporary = request.outputPath ?? path.join(root, 'temporary.mp4');
    if (!request.outputPath) request.tempFiles.push(temporary);
    await fs.writeFile(temporary, 'rendered');
    return temporary;
  });
  mocks.concat.mockImplementation(
    async (_binary: unknown, _inputs: unknown, staging: string) => {
      await fs.writeFile(staging, 'complete');
    },
  );
  const collision = vi.fn(async (source: string, target: string) => {
    expect(target).toBe(output);
    expect(path.basename(source)).toBe('output.mp4');
    await fs.writeFile(target, 'other job', { flag: 'wx' });
    await fs.link(source, target);
  });
  mocks.publishOverride = collision;
  const handler = mocks.handlers.get('export-clips-with-overlay');
  if (!handler) throw new Error('handler missing');
  const result = await handler(
    {} as never,
    {
      sourcePath: '/synthetic.mp4',
      outputDir: root,
      exportMode: 'single',
      progressId: `collision-${platform}`,
      clips: [{ id: 'one', actionName: 'First', startTime: 1, endTime: 3 }],
      overlay: {
        enabled: false,
        showActionName: false,
        showActionIndex: false,
        showLabels: false,
        showMemo: false,
      },
    } as never,
  );
  expect(result).toMatchObject({ success: false, error: expect.stringContaining('EEXIST') });
  expect(collision).toHaveBeenCalledOnce();
  expect(await fs.readFile(output, 'utf8')).toBe('other job');
  const states = mocks.progress.mock.calls.map(
    ([state]) => state as { message?: string; status?: string },
  );
  expect(
    states.some(
      (state) =>
        state.status === 'completed' ||
        state.message === '書き出しが完了しました',
    ),
  ).toBe(false);
  expect(states.at(-1)?.status).toBe('failed');
});

it('runs the real IPC per-instance route, preserves completed clips and removes the failed fallback output', async () => {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), 'export-ipc-transaction-'),
  );
  roots.push(root);
  await fs.writeFile(path.join(root, 'unrelated.mp4'), 'preserved');
  let count = 0;
  mocks.render.mockImplementation(async (request: { outputPath: string }) => {
    count++;
    await fs.writeFile(
      request.outputPath,
      count === 1 ? 'complete' : 'partial',
    );
    if (count === 2) throw new Error('encoder failure');
    return request.outputPath;
  });
  const payload = {
    sourcePath: '/synthetic.mp4',
    outputDir: root,
    exportMode: 'perInstance',
    clips: [
      { id: 'one', actionName: 'First', startTime: 1, endTime: 3 },
      { id: 'two', actionName: 'Second', startTime: 4, endTime: 6 },
    ],
    overlay: {
      enabled: false,
      showActionName: false,
      showActionIndex: false,
      showLabels: false,
      showMemo: false,
    },
  };
  const handler = mocks.handlers.get('export-clips-with-overlay');
  if (!handler) throw new Error('handler missing');
  const result = await handler({} as never, payload as never);
  expect(result).toMatchObject({ success: false });
  const names = (await fs.readdir(root)).sort();
  expect(names).toEqual(['001_First_angle1.mp4', 'unrelated.mp4']);
  expect(await fs.readFile(path.join(root, names[0]), 'utf8')).toBe('complete');
  expect(await fs.readFile(path.join(root, 'unrelated.mp4'), 'utf8')).toBe(
    'preserved',
  );
});

it('reports cancellation only after the renderer has stopped and staging is removed', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'export-ipc-cancel-'));
  roots.push(root);
  let finish: (() => void) | undefined;
  let running = false;
  mocks.render.mockImplementation(async (request: { outputPath: string }) => {
    await fs.writeFile(request.outputPath, 'partial');
    running = true;
    await new Promise<void>((resolve) => {
      finish = resolve;
    });
    return request.outputPath;
  });
  const handler = mocks.handlers.get('export-clips-with-overlay');
  if (!handler) throw new Error('handler missing');
  const task = handler(
    {} as never,
    {
      sourcePath: '/synthetic.mp4',
      outputDir: root,
      exportMode: 'perInstance',
      progressId: 'cancel-test',
      clips: [{ id: 'one', actionName: 'First', startTime: 1, endTime: 3 }],
      overlay: {
        enabled: false,
        showActionName: false,
        showActionIndex: false,
        showLabels: false,
        showMemo: false,
      },
    } as never,
  );
  await vi.waitFor(() => expect(running).toBe(true));
  expect(mocks.cancel?.('other-job')).toBe('not-found');
  expect(mocks.cancel?.('cancel-test')).toBe('accepted');
  expect(mocks.cancel?.('cancel-test')).toBe('already-requested');
  expect(
    mocks.progress.mock.calls.some(
      ([state]) => (state as { status?: string }).status === 'cancelled',
    ),
  ).toBe(false);
  finish?.();
  expect(await task).toMatchObject({ success: false, canceled: true });
  expect(await fs.readdir(root)).toEqual([]);
  expect(
    mocks.progress.mock.calls.some(
      ([state]) => (state as { status?: string }).status === 'cancelled',
    ),
  ).toBe(true);
  expect(mocks.cancel?.('cancel-test')).toBe('not-found');
});

it('keeps the first published clip and reports cleanup failure when a later clip is cancelled', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'export-ipc-partial-'));
  roots.push(root);
  let finish: (() => void) | undefined;
  let count = 0;
  mocks.render.mockImplementation(async (request: { outputPath: string; tempFiles: string[] }) => {
    count++;
    await fs.writeFile(request.outputPath, count === 1 ? 'first' : 'partial');
    if (count === 2) {
      request.tempFiles.push(root);
      await new Promise<void>((resolve) => {
        finish = resolve;
      });
    }
    return request.outputPath;
  });
  const handler = mocks.handlers.get('export-clips-with-overlay');
  if (!handler) throw new Error('handler missing');
  const task = handler(
    {} as never,
    {
      sourcePath: '/synthetic.mp4',
      outputDir: root,
      exportMode: 'perInstance',
      progressId: 'partial-test',
      clips: [
        { id: 'one', actionName: 'First', startTime: 1, endTime: 3 },
        { id: 'two', actionName: 'Second', startTime: 4, endTime: 6 },
      ],
      overlay: {
        enabled: false,
        showActionName: false,
        showActionIndex: false,
        showLabels: false,
        showMemo: false,
      },
    } as never,
  );
  await vi.waitFor(() => expect(finish).toBeDefined());
  expect(mocks.cancel?.('partial-test')).toBe('accepted');
  finish?.();
  expect(await task).toMatchObject({
    success: false,
    canceled: true,
    error: expect.stringContaining('001_First_angle1.mp4'),
    retainedLocationUnknown: true,
  });
  expect(await fs.readdir(root)).toEqual(['001_First_angle1.mp4']);
  expect(
    await fs.readFile(path.join(root, '001_First_angle1.mp4'), 'utf8'),
  ).toBe('first');
});

it('finishes cancellation when the pending folder dialog is also dismissed', async () => {
  let finish:
    | ((value: { canceled: boolean; filePaths: string[] }) => void)
    | undefined;
  mocks.dialog.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const handler = mocks.handlers.get('export-clips-with-overlay');
  if (!handler) throw new Error('handler missing');
  const task = handler(
    {} as never,
    {
      sourcePath: '/synthetic.mp4',
      exportMode: 'perInstance',
      progressId: 'dialog-test',
      clips: [{ id: 'one', actionName: 'First', startTime: 1, endTime: 3 }],
      overlay: {
        enabled: false,
        showActionName: false,
        showActionIndex: false,
        showLabels: false,
        showMemo: false,
      },
    } as never,
  );
  await vi.waitFor(() => expect(finish).toBeDefined());
  expect(mocks.cancel?.('dialog-test')).toBe('accepted');
  finish?.({ canceled: true, filePaths: [] });
  expect(await task).toMatchObject({ success: false, canceled: true });
  expect(
    mocks.progress.mock.calls.some(
      ([state]) => (state as { status?: string }).status === 'cancelled',
    ),
  ).toBe(true);
});

it('does not report cancellation complete if a previously committed staging directory remains', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'export-ipc-cleanup-'));
  roots.push(root);
  let finish: (() => void) | undefined;
  let count = 0;
  mocks.render.mockImplementation(async (request: { outputPath: string }) => {
    count++;
    await fs.writeFile(request.outputPath, 'data');
    if (count === 1)
      await fs.writeFile(
        path.join(path.dirname(request.outputPath), 'unexpected'),
        'keep',
      );
    else
      await new Promise<void>((resolve) => {
        finish = resolve;
      });
    return request.outputPath;
  });
  const handler = mocks.handlers.get('export-clips-with-overlay');
  if (!handler) throw new Error('handler missing');
  const task = handler(
    {} as never,
    {
      sourcePath: '/synthetic.mp4',
      outputDir: root,
      exportMode: 'perInstance',
      progressId: 'cleanup-test',
      clips: [
        { id: 'one', actionName: 'First', startTime: 1, endTime: 3 },
        { id: 'two', actionName: 'Second', startTime: 4, endTime: 6 },
      ],
      overlay: {
        enabled: false,
        showActionName: false,
        showActionIndex: false,
        showLabels: false,
        showMemo: false,
      },
    } as never,
  );
  const rejected = expect(task).resolves.toMatchObject({ canceled: true, error: expect.stringContaining('片付け') });
  await vi.waitFor(() => expect(finish).toBeDefined());
  expect(mocks.cancel?.('cleanup-test')).toBe('accepted');
  finish?.();
  await rejected;
  const statuses = mocks.progress.mock.calls.map(
    ([state]) => (state as { status?: string }).status,
  );
  expect(statuses).not.toContain('cancelled');
  expect(statuses).toContain('failed');
  expect(
    await fs.readFile(path.join(root, '001_First_angle1.mp4'), 'utf8'),
  ).toBe('data');
});

it('merges all uncertain and independently retained locations without logging private paths', async () => {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), 'export-ipc-uncertain-'),
  );
  roots.push(root);
  const failure = new IndeterminatePublicationError();
  const makeRecord = (id: string) => ({ id, path: path.join(root, id), purpose: 'native-temp' as const, device: '1', inode: id, reason: 'retained-after-failure' as const, writerStatus: 'unknown' as const });
  failure.retain(makeRecord('uncertain'));
  rememberRetained(failure, makeRecord('copy-1'));
  rememberRetained(failure, makeRecord('copy-2'));
  rememberRetained(failure, makeRecord('copy-3'));
  rememberRetained(failure);
  mocks.native.mockRejectedValueOnce(failure);
  const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  try {
    const handler = mocks.handlers.get('export-clips-with-overlay');
    if (!handler) throw new Error('handler missing');
    const result = await handler(
      {} as never,
      {
        sourcePath: '/synthetic.mp4',
        outputDir: root,
        exportMode: 'perInstance',
        progressId: 'uncertain-test',
        clips: [{ id: 'one', actionName: 'First', startTime: 1, endTime: 3 }],
        overlay: {
          enabled: false,
          showActionName: false,
          showActionIndex: false,
          showLabels: false,
          showMemo: false,
        },
      } as never,
    );
    expect(result).toMatchObject({ success: false, retainedLocationUnknown: true, retainedDirectories: expect.any(Array) });
    expect((result as { retainedDirectories: unknown[] }).retainedDirectories).toHaveLength(5);
    const state = mocks.progress.mock.calls
      .map(
        ([value]) =>
          value as {
            retainedDirectories?: Array<{
              path: string;
              writerStatus: string;
              purpose: string;
            }>;
          },
      )
      .find((value) => value.retainedDirectories?.length);
    expect(state?.retainedDirectories).toHaveLength(5);
    expect(state?.retainedDirectories).toEqual(expect.arrayContaining([expect.objectContaining({ purpose: 'final-staging', writerStatus: 'unknown' })]));
    expect(state?.retainedDirectories?.[0].path.startsWith(root)).toBe(true);
    expect(JSON.stringify(log.mock.calls)).not.toContain(root);
    expect(
      (await fs.readdir(root)).some((name) =>
        name.startsWith('.sportag-export-'),
      ),
    ).toBe(true);
  } finally {
    log.mockRestore();
  }
});

it('opens a retained-location report even when the export did not provide a progress ID', async () => {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), 'export-ipc-no-progress-'),
  );
  roots.push(root);
  mocks.native.mockRejectedValueOnce(new IndeterminatePublicationError());
  const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  try {
    const handler = mocks.handlers.get('export-clips-with-overlay');
    if (!handler) throw new Error('handler missing');
    expect(
      await handler(
        {} as never,
        {
          sourcePath: '/synthetic.mp4',
          outputDir: root,
          exportMode: 'perInstance',
          clips: [{ id: 'one', actionName: 'First', startTime: 1, endTime: 3 }],
          overlay: {
            enabled: false,
            showActionName: false,
            showActionIndex: false,
            showLabels: false,
            showMemo: false,
          },
        } as never,
      ),
    ).toMatchObject({ success: false, retainedDirectories: expect.any(Array) });
    const state = mocks.progress.mock.calls
      .map(
        ([value]) => value as { id?: string; retainedDirectories?: unknown[] },
      )
      .find((value) => value.retainedDirectories?.length);
    expect(state?.id).toMatch(/^export-uncertain-/);
    expect(state?.retainedDirectories).toHaveLength(1);
  } finally {
    log.mockRestore();
  }
});


it('does not invoke FFmpeg for an unknown native helper failure in the Main handler', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'export-ipc-unknown-')); roots.push(root);
  const { NativeExportUnknownFailure } = await import('../nativeExport/nativeClipExport');
  mocks.native.mockRejectedValueOnce(new NativeExportUnknownFailure(new Error('private data')));
  const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  try {
    const handler = mocks.handlers.get('export-clips-with-overlay'); if (!handler) throw new Error('handler missing');
    const result = await handler({} as never, { sourcePath: '/synthetic.mp4', outputDir: root, exportMode: 'perInstance', clips: [{ id: 'one', actionName: 'A', startTime: 1, endTime: 3 }], overlay: { enabled: false, showActionName: false, showActionIndex: false, showLabels: false, showMemo: false } } as never);
    expect(result).toMatchObject({ success: false });
    expect(mocks.render).not.toHaveBeenCalled(); expect(mocks.concat).not.toHaveBeenCalled();
    expect(JSON.stringify(log.mock.calls)).not.toContain('private data');
  } finally { log.mockRestore(); }
});

it('reports a retained copy directory from the Main handler without logging it', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'export-ipc-copy-retained-')); roots.push(root);
  const { ExportCopyIncomplete } = await import('./exportBoundedCopy');
  const stage = await fs.mkdtemp(path.join(root, 'private-')); const partial = path.join(stage, 'partial.mp4'); await fs.writeFile(partial, 'partial');
  const copyError = new ExportCopyIncomplete(Object.assign(new Error('disk full'), { code: 'ENOSPC' }), partial);
  const { rememberRetained } = await import('./exportRetainedRecords');
  const { describeExportStaging } = await import('./exportExclusivePublish');
  const nativeTemp = await fs.mkdtemp(path.join(root, 'native-temp-'));
  rememberRetained(copyError, await describeExportStaging(stage, 'native-staging', 'retained-after-failure'));
  rememberRetained(copyError, await describeExportStaging(nativeTemp, 'native-temp', 'retained-after-failure'));
  mocks.native.mockRejectedValueOnce(copyError);
  const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  try {
    const handler = mocks.handlers.get('export-clips-with-overlay'); if (!handler) throw new Error('handler missing');
    const result = await handler({} as never, { sourcePath: '/synthetic.mp4', outputDir: root, exportMode: 'perInstance', progressId: 'copy-retained', clips: [{ id: 'one', actionName: 'A', startTime: 1, endTime: 3 }], overlay: { enabled: false, showActionName: false, showActionIndex: false, showLabels: false, showMemo: false } } as never);
    expect(result).toMatchObject({ success: false, error: '保存先の空き容量が不足しました', retainedDirectories: expect.arrayContaining([expect.objectContaining({ path: stage, writerStatus: 'unknown' })]) });
    expect((result as { retainedDirectories: Array<{ purpose: string }> }).retainedDirectories.map((entry) => entry.purpose).sort()).toEqual(['final-staging', 'native-staging', 'native-temp']);
    expect(await fs.readFile(partial, 'utf8')).toBe('partial');
    expect(JSON.stringify(log.mock.calls)).not.toContain(root);
  } finally { log.mockRestore(); }
});

it('does not report a completed cancellation when the copy handle close failed', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'export-ipc-close-unknown-')); roots.push(root);
  const { ExportCopyIncomplete } = await import('./exportBoundedCopy');
  const stage = await fs.mkdtemp(path.join(root, 'private-')); const partial = path.join(stage, 'partial.mp4'); await fs.writeFile(partial, 'partial');
  const cause = Object.assign(new Error('cancelled'), { name: 'AbortError' });
  const copyError = new ExportCopyIncomplete(cause, partial, [new Error('close failure')]);
  const { rememberRetained } = await import('./exportRetainedRecords');
  const { describeExportStaging } = await import('./exportExclusivePublish');
  rememberRetained(copyError, await describeExportStaging(stage, 'native-staging', 'retained-after-failure'));
  mocks.native.mockImplementationOnce(async () => { expect(mocks.cancel?.('copy-close')).toBe('accepted'); throw copyError; });
  const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  try {
    const handler = mocks.handlers.get('export-clips-with-overlay'); if (!handler) throw new Error('handler missing');
    const result = await handler({} as never, { sourcePath: '/synthetic.mp4', outputDir: root, exportMode: 'perInstance', progressId: 'copy-close', clips: [{ id: 'one', actionName: 'A', startTime: 1, endTime: 3 }], overlay: { enabled: false, showActionName: false, showActionIndex: false, showLabels: false, showMemo: false } } as never);
    expect(result).toMatchObject({ success: false, retainedDirectories: expect.arrayContaining([expect.objectContaining({ path: stage })]) });
    expect(result).not.toMatchObject({ canceled: true });
    expect(await fs.readFile(partial, 'utf8')).toBe('partial');
  } finally { log.mockRestore(); }
});

it('reports retained data with unknown location when the directory cannot be identified', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'export-ipc-copy-unknown-')); roots.push(root);
  const { ExportCopyIncomplete } = await import('./exportBoundedCopy');
  mocks.native.mockRejectedValueOnce(new ExportCopyIncomplete(new Error('disk full'), path.join(root, 'missing', 'partial')));
  const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  try {
    const handler = mocks.handlers.get('export-clips-with-overlay'); if (!handler) throw new Error('handler missing');
    await handler({} as never, { sourcePath: '/synthetic.mp4', outputDir: root, exportMode: 'perInstance', clips: [{ id: 'one', actionName: 'A', startTime: 1, endTime: 3 }], overlay: { enabled: false, showActionName: false, showActionIndex: false, showLabels: false, showMemo: false } } as never);
    const states = mocks.progress.mock.calls.map(([value]) => value as { retainedLocationUnknown?: boolean });
    expect(states.some((state) => state.retainedLocationUnknown === true)).toBe(true);
  } finally { log.mockRestore(); }
});

it('reports retained cleanup after publication without claiming total completion', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'export-ipc-success-cleanup-')); roots.push(root);
  mocks.native.mockImplementationOnce(async (request: { outputPath: string }) => {
    await fs.writeFile(request.outputPath, 'complete'); await fs.writeFile(path.join(path.dirname(request.outputPath), 'unexpected'), 'retain');
    return { status: 'completed' as const };
  });
  const handler = mocks.handlers.get('export-clips-with-overlay'); if (!handler) throw new Error('handler missing');
  const result = await handler({} as never, { sourcePath: '/synthetic.mp4', outputDir: root, exportMode: 'perInstance', progressId: 'success-cleanup', clips: [{ id: 'one', actionName: 'A', startTime: 1, endTime: 3 }], overlay: { enabled: false, showActionName: false, showActionIndex: false, showLabels: false, showMemo: false } } as never);
  expect(result).toMatchObject({ success: true, cleanupWarning: expect.stringContaining('保存されました'), retainedDirectories: [expect.objectContaining({ purpose: 'final-staging', reason: 'cleanup-failed' })], publishedOutputs: [path.join(root, '001_A_angle1.mp4')] });
  expect(await fs.readFile(path.join(root, '001_A_angle1.mp4'), 'utf8')).toBe('complete');
  const states = mocks.progress.mock.calls.map(([value]) => value as { status?: string });
  expect(states.some((state) => state.status === 'completed')).toBe(true);
  expect(mocks.progress.mock.calls.some(([value]) => (value as { message?: string }).message === '書き出しが完了しました')).toBe(false);
  expect(states.some((state) => state.status === 'failed')).toBe(false);
});

it('reports already published outputs when a subsequent clip fails', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'export-ipc-partial-')); roots.push(root);
  mocks.native.mockImplementationOnce(async (request: { outputPath: string }) => {
    await fs.writeFile(request.outputPath, 'complete');
    return { status: 'completed' as const };
  });
  mocks.native.mockRejectedValueOnce(new Error('second failed'));
  const handler = mocks.handlers.get('export-clips-with-overlay'); if (!handler) throw new Error('handler missing');
  const result = await handler({} as never, { sourcePath: '/synthetic.mp4', outputDir: root, exportMode: 'perInstance', progressId: 'partial', clips: [{ id: 'one', actionName: 'A', startTime: 1, endTime: 3 }, { id: 'two', actionName: 'B', startTime: 4, endTime: 6 }], overlay: { enabled: false, showActionName: false, showActionIndex: false, showLabels: false, showMemo: false } } as never);
  const saved = path.join(root, '001_A_angle1.mp4');
  expect(result).toMatchObject({ success: false, error: expect.stringContaining(saved), publishedOutputs: [saved] });
  expect(await fs.readFile(saved, 'utf8')).toBe('complete');
  expect(mocks.progress.mock.calls.some(([value]) => (value as { error?: string }).error?.includes(saved))).toBe(true);
});

it('reports an unknown retained location when cleanup fails after an error without a progress ID', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'export-ipc-cleanup-unknown-')); roots.push(root);
  mocks.render.mockImplementation(async (request: { tempFiles: string[] }) => {
    request.tempFiles.push(root);
    throw new Error('render failed');
  });
  const handler = mocks.handlers.get('export-clips-with-overlay'); if (!handler) throw new Error('handler missing');
  const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  try {
    const result = await handler({} as never, { sourcePath: '/synthetic.mp4', outputDir: root, exportMode: 'perInstance', clips: [{ id: 'one', actionName: 'A', startTime: 1, endTime: 3 }], overlay: { enabled: false, showActionName: false, showActionIndex: false, showLabels: false, showMemo: false } } as never);
    expect(result).toMatchObject({ success: false, error: expect.stringContaining('render failed'), retainedLocationUnknown: true });
    expect(mocks.progress.mock.calls.some(([value]) => (value as { retainedLocationUnknown?: boolean }).retainedLocationUnknown === true)).toBe(true);
  } finally { log.mockRestore(); }
});

it.each(['with-id', 'without-id'])('reports unknown cleanup after a saved output (%s)', async (variant) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'export-ipc-cleanup-saved-')); roots.push(root);
  mocks.render.mockImplementation(async (request: { tempFiles: string[]; outputPath: string }) => {
    request.tempFiles.push(root);
    await fs.writeFile(request.outputPath, 'complete');
    return request.outputPath;
  });
  const handler = mocks.handlers.get('export-clips-with-overlay'); if (!handler) throw new Error('handler missing');
  const result = await handler({} as never, { sourcePath: '/synthetic.mp4', outputDir: root, exportMode: 'perInstance', ...(variant === 'with-id' ? {progressId: 'saved-cleanup'} : {}), clips: [{ id: 'one', actionName: 'A', startTime: 1, endTime: 3 }], overlay: { enabled: false, showActionName: false, showActionIndex: false, showLabels: false, showMemo: false } } as never);
  expect(result).toMatchObject({ success: true, cleanupWarning: expect.stringContaining('保存されました'), retainedLocationUnknown: true });
  expect(await fs.readFile(path.join(root, '001_A_angle1.mp4'), 'utf8')).toBe('complete');
  expect(mocks.progress.mock.calls.some(([value]) => (value as { retainedLocationUnknown?: boolean }).retainedLocationUnknown === true)).toBe(true);
});

it('does not report missing temporary files as retained', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'export-ipc-cleanup-missing-')); roots.push(root);
  mocks.render.mockImplementation(async (request: { tempFiles: string[]; outputPath: string }) => {
    request.tempFiles.push(path.join(root, 'already-gone'));
    await fs.writeFile(request.outputPath, 'complete'); return request.outputPath;
  });
  const handler = mocks.handlers.get('export-clips-with-overlay'); if (!handler) throw new Error('handler missing');
  const result = await handler({} as never, { sourcePath: '/synthetic.mp4', outputDir: root, exportMode: 'perInstance', clips: [{ id: 'one', actionName: 'A', startTime: 1, endTime: 3 }], overlay: { enabled: false, showActionName: false, showActionIndex: false, showLabels: false, showMemo: false } } as never);
  expect(result).toMatchObject({ success: true });
  expect(result).not.toHaveProperty('retainedLocationUnknown');
});

it('reports cleanup uncertainty after user cancellation', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'export-ipc-cancel-cleanup-')); roots.push(root);
  mocks.render.mockImplementation(async (request: { tempFiles: string[] }) => {
    request.tempFiles.push(root);
    expect(mocks.cancel?.('cancel-cleanup')).toBe('accepted');
    throw Object.assign(new Error('canceled'), { name: 'AbortError' });
  });
  const handler = mocks.handlers.get('export-clips-with-overlay'); if (!handler) throw new Error('handler missing');
  const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  try {
    const result = await handler({} as never, { sourcePath: '/synthetic.mp4', outputDir: root, exportMode: 'perInstance', progressId: 'cancel-cleanup', clips: [{ id: 'one', actionName: 'A', startTime: 1, endTime: 3 }], overlay: { enabled: false, showActionName: false, showActionIndex: false, showLabels: false, showMemo: false } } as never);
    expect(result).toMatchObject({ success: false, canceled: true, retainedLocationUnknown: true });
    expect(mocks.progress.mock.calls.some(([value]) => (value as { retainedLocationUnknown?: boolean }).retainedLocationUnknown === true)).toBe(true);
  } finally { log.mockRestore(); }
});

it('cancels a waiting job without aborting the active job', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'export-ipc-waiting-')); roots.push(root);
  let finish: (() => void) | undefined;
  mocks.render.mockImplementation(async (request: { outputPath: string }) => {
    await new Promise<void>((resolve) => { finish = resolve; });
    await fs.writeFile(request.outputPath, 'complete'); return request.outputPath;
  });
  const handler = mocks.handlers.get('export-clips-with-overlay'); if (!handler) throw new Error('handler missing');
  const payload = { sourcePath: '/synthetic.mp4', outputDir: root, exportMode: 'perInstance', clips: [{ id: 'one', actionName: 'A', startTime: 1, endTime: 3 }], overlay: { enabled: false, showActionName: false, showActionIndex: false, showLabels: false, showMemo: false } };
  const first = handler({} as never, { ...payload, progressId: 'active-job' } as never);
  await vi.waitFor(() => expect(finish).toBeDefined());
  const second = handler({} as never, { ...payload, progressId: 'waiting-job' } as never);
  await vi.waitFor(() => expect(mocks.cancel?.('waiting-job')).toBe('accepted'));
  await expect(second).resolves.toMatchObject({ success: false, canceled: true });
  expect(mocks.render).toHaveBeenCalledTimes(1); finish?.();
  await expect(first).resolves.toMatchObject({ success: true });
});

it('releases the Main job gate after a failure so the next job can finish', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'export-ipc-fail-then-next-')); roots.push(root);
  let rejectFirst: ((reason: Error) => void) | undefined;
  let markStarted: (() => void) | undefined;
  const started = new Promise<void>((resolve) => { markStarted = resolve; });
  mocks.native.mockImplementationOnce(async () => new Promise<never>((_resolve, reject) => { rejectFirst = reject; markStarted?.(); }));
  mocks.render.mockImplementation(async (request: { outputPath: string }) => { await fs.writeFile(request.outputPath, 'complete'); return request.outputPath; });
  const handler = mocks.handlers.get('export-clips-with-overlay'); if (!handler) throw new Error('handler missing');
  const payload = { sourcePath: '/synthetic.mp4', outputDir: root, exportMode: 'perInstance', clips: [{ id: 'one', actionName: 'A', startTime: 1, endTime: 3 }], overlay: { enabled: false, showActionName: false, showActionIndex: false, showLabels: false, showMemo: false } };
  const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  try {
    const first = handler({} as never, { ...payload, progressId: 'first-fails' } as never);
    await started;
    const next = handler({} as never, { ...payload, progressId: 'next-succeeds' } as never);
    rejectFirst?.(new Error('first failed'));
    expect(await first).toMatchObject({ success: false });
    expect(await next).toMatchObject({ success: true });
    expect(await fs.readFile(path.join(root, '001_A_angle1.mp4'), 'utf8')).toBe('complete');
  } finally { log.mockRestore(); }
});

it.each(['success', 'uncertain'])('returns too-late when cancellation occurs during publication: %s', async (outcome) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'export-ipc-inflight-')); roots.push(root);
  let resume: (() => void) | undefined; let markStarted: (() => void) | undefined;
  const started = new Promise<void>((resolve) => { markStarted = resolve; });
  const blocked = new Promise<void>((resolve) => { resume = resolve; });
  mocks.render.mockImplementation(async (request: { outputPath: string }) => { await fs.writeFile(request.outputPath, 'complete'); return request.outputPath; });
  mocks.publishOverride = async (source, target) => { markStarted?.(); await blocked; if (outcome === 'uncertain') throw new IndeterminatePublicationError(); await fs.link(source, target); };
  const handler = mocks.handlers.get('export-clips-with-overlay'); if (!handler) throw new Error('handler missing');
  const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  try {
    const id = `inflight-${outcome}`;
    const task = handler({} as never, { sourcePath: '/synthetic.mp4', outputDir: root, exportMode: 'perInstance', progressId: id, clips: [{ id: 'one', actionName: 'A', startTime: 1, endTime: 3 }], overlay: { enabled: false, showActionName: false, showActionIndex: false, showLabels: false, showMemo: false } } as never);
    await started; expect(mocks.cancel?.(id)).toBe('too-late'); resume?.();
    const result = await task;
    if (outcome === 'success') { expect(result).toMatchObject({ success: true }); expect(await fs.readFile(path.join(root, '001_A_angle1.mp4'), 'utf8')).toBe('complete'); }
    else { expect(result).toMatchObject({ success: false, retainedDirectories: expect.any(Array) }); expect((await fs.readdir(root)).some((name) => name.startsWith('.sportag-export-'))).toBe(true); await expect(fs.stat(path.join(root, '001_A_angle1.mp4'))).rejects.toThrow(); }
  } finally { log.mockRestore(); }
});

it.each([1, 2])('keeps committed output when finish callbacks fail %i time(s) alongside cleanup failure', async (failures) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'export-ipc-finish-failure-')); roots.push(root);
  mocks.finishFailures = failures;
  mocks.render.mockImplementation(async (request: { outputPath: string }) => {
    await fs.writeFile(request.outputPath, 'complete');
    await fs.writeFile(path.join(path.dirname(request.outputPath), 'keep'), 'keep');
    return request.outputPath;
  });
  const handler = mocks.handlers.get('export-clips-with-overlay'); if (!handler) throw new Error('handler missing');
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  try {
    const result = await handler({} as never, { sourcePath: '/synthetic.mp4', outputDir: root, exportMode: 'perInstance', progressId: `finish-fail-${failures}`, clips: [{ id: 'one', actionName: 'A', startTime: 1, endTime: 3 }], overlay: { enabled: false, showActionName: false, showActionIndex: false, showLabels: false, showMemo: false } } as never);
    if (failures === 1) {
      expect(result).toMatchObject({ success: true, publishedOutputs: [path.join(root, '001_A_angle1.mp4')], retainedDirectories: expect.any(Array) });
      expect((result as { cleanupWarning: string }).cleanupWarning).toContain('通知を確認できません');
      expect((result as { cleanupWarning: string }).cleanupWarning).toContain('後処理を確認できません');
    } else {
      expect(result).toMatchObject({ success: false, publishedOutputs: [path.join(root, '001_A_angle1.mp4')], error: expect.stringContaining('復旧できない') });
    }
    expect(await fs.readFile(path.join(root, '001_A_angle1.mp4'), 'utf8')).toBe('complete');
  } finally { warn.mockRestore(); }
});

it('stops before the next clip when committed-state recovery fails', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'export-ipc-finish-stop-')); roots.push(root);
  mocks.finishFailures = 2;
  mocks.render.mockImplementation(async (request: { outputPath: string }) => { await fs.writeFile(request.outputPath, 'complete'); return request.outputPath; });
  const handler = mocks.handlers.get('export-clips-with-overlay'); if (!handler) throw new Error('handler missing');
  const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  try {
    const result = await handler({} as never, { sourcePath: '/synthetic.mp4', outputDir: root, exportMode: 'perInstance', progressId: 'finish-stop', clips: [{ id: 'one', actionName: 'A', startTime: 1, endTime: 3 }, { id: 'two', actionName: 'B', startTime: 4, endTime: 6 }], overlay: { enabled: false, showActionName: false, showActionIndex: false, showLabels: false, showMemo: false } } as never);
    expect(result).toMatchObject({ success: false, publishedOutputs: [path.join(root, '001_A_angle1.mp4')], error: expect.stringContaining('復旧できない') });
    expect(mocks.render).toHaveBeenCalledTimes(1);
    expect(await fs.readFile(path.join(root, '001_A_angle1.mp4'), 'utf8')).toBe('complete');
  } finally { log.mockRestore(); }
});

it('propagates a real quit event through the IPC route and refuses post-quit publication', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'export-ipc-quit-'));
  roots.push(root);
  mocks.render.mockImplementation(
    async (request: {
      outputPath: string;
      onProgress?: (value: number) => void;
    }) => {
      await fs.writeFile(request.outputPath, 'complete');
      mocks.quit?.({ preventDefault: vi.fn() });
      const notifications = mocks.progress.mock.calls.length;
      request.onProgress?.(0.9);
      expect(mocks.progress.mock.calls.length).toBe(notifications);
      return request.outputPath;
    },
  );
  const handler = mocks.handlers.get('export-clips-with-overlay');
  if (!handler) throw new Error('handler missing');
  const result = await handler(
    {} as never,
    {
      sourcePath: '/synthetic.mp4',
      outputDir: root,
      exportMode: 'perInstance',
      progressId: 'quit-test',
      clips: [{ id: 'one', actionName: 'First', startTime: 1, endTime: 3 }],
      overlay: {
        enabled: false,
        showActionName: false,
        showActionIndex: false,
        showLabels: false,
        showMemo: false,
      },
    } as never,
  );
  expect(result).toMatchObject({ success: false });
  expect(await fs.readdir(root)).toEqual([]);
  expect(mocks.appQuit).toHaveBeenCalledOnce();
  expect(mocks.native.mock.calls[0]?.[0].signal?.aborted).toBe(true);
  expect(
    mocks.progress.mock.calls.some(
      ([state]) => (state as { status?: string }).status === 'failed',
    ),
  ).toBe(false);
});
