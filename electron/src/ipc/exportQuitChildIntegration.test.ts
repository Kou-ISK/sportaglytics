// @vitest-environment node
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { expect, it, vi } from 'vitest';
import { runFfmpegProcess } from './exportFfmpegProcess';

const mocks = vi.hoisted(() => ({
  handlers: new Map<string, (...args: never[]) => Promise<unknown>>(),
  quit: undefined as
    | ((event: { preventDefault: () => void }) => void)
    | undefined,
  resumed: vi.fn(),
  render: vi.fn(),
}));
vi.mock('electron', () => ({
  app: {
    on: (
      _name: string,
      listener: (event: { preventDefault: () => void }) => void,
    ) => {
      mocks.quit = listener;
    },
    quit: mocks.resumed,
  },
  ipcMain: {
    handle: (name: string, handler: (...args: never[]) => Promise<unknown>) =>
      mocks.handlers.set(name, handler),
  },
  BrowserWindow: {},
  dialog: {},
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
vi.mock('../exportProgressWindow', () => ({
  updateExportProgressWindow: vi.fn(),
  openExportProgressWindow: async () => undefined,
  setExportCancelHandler: () => undefined,
}));
import { registerExportHandlers } from './exportHandlers';

it.skipIf(process.platform === 'win32')(
  'drains its own real child before completing the IPC quit',
  async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'export-ipc-child-'));
    const ready = path.join(root, 'ready');
    const closed = path.join(root, 'closed');
    const program = `const fs=require('node:fs'); process.on('SIGTERM',()=>setTimeout(()=>{fs.writeFileSync(process.argv[2],'closed');process.exit(0)},75));fs.writeFileSync(process.argv[1],'ready');setInterval(()=>{},1000);`;
    mocks.render.mockImplementation(async (request: { outputPath: string }) => {
      await runFfmpegProcess(
        () => process.execPath,
        ['-e', program, ready, closed],
      );
      await fs.writeFile(request.outputPath, 'should not publish');
      return request.outputPath;
    });
    registerExportHandlers({
      getMainWindow: () => null,
      getFfmpegPath: () => 'unused',
    });
    const handler = mocks.handlers.get('export-clips-with-overlay');
    if (!handler) throw new Error('handler missing');
    const task = handler(
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
    );
    try {
      await vi.waitFor(async () =>
        expect(await fs.readFile(ready, 'utf8')).toBe('ready'),
      );
      const preventDefault = vi.fn();
      mocks.quit?.({ preventDefault });
      expect(preventDefault).toHaveBeenCalledOnce();
      expect(mocks.resumed).not.toHaveBeenCalled();
      expect(await task).toMatchObject({ success: false });
      expect(await fs.readFile(closed, 'utf8')).toBe('closed');
      expect(mocks.resumed).toHaveBeenCalledOnce();
      expect((await fs.readdir(root)).sort()).toEqual(['closed', 'ready']);
    } finally {
      mocks.quit?.({ preventDefault: vi.fn() });
      await task.catch(() => undefined);
      await fs.rm(root, { recursive: true, force: true });
    }
  },
);
