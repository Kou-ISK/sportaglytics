import { EventEmitter } from 'node:events';
import { beforeEach, expect, it, vi } from 'vitest';
import { LIVE_CAPTURE_CHANNELS as channels } from '../../../src/types/ipc/liveCapture';
import { registerLiveCaptureHandlers } from './captureHandlers';

const mocks = vi.hoisted(() => ({
  app: { on: vi.fn(), quit: vi.fn() },
  handle: vi.fn(),
  save: vi.fn(),
  send: vi.fn(),
  lifecycle: vi.fn(),
  sessions: [] as Array<{
    snapshot: { phase: string };
    stop: ReturnType<typeof vi.fn>;
  }>,
}));
const sender = { mainFrame: {}, isDestroyed: () => false, send: mocks.send };
vi.mock('electron', () => ({
  app: mocks.app,
  BrowserWindow: { fromWebContents: vi.fn() },
  dialog: { showSaveDialog: mocks.save },
  ipcMain: { handle: mocks.handle },
  powerSaveBlocker: { start: vi.fn(), stop: vi.fn() },
}));
vi.mock('../mediaTools', () => ({ getFfmpegPath: () => 'synthetic-ffmpeg' }));
vi.mock('../windowsH264Capability', () => ({
  ensureWindowsH264Encoder: vi.fn(),
}));
vi.mock('../packageSessionRegistry', () => ({}));
vi.mock('./captureWindow', () => ({
  getCaptureWindow: () => ({ webContents: sender, isDestroyed: () => false }),
  hideLiveCaptureWindow: vi.fn(),
  setCaptureWindowLifecycle: mocks.lifecycle,
}));
vi.mock('./captureSession', () => ({
  CaptureSession: class {
    snapshot = { phase: 'recording' };
    start = vi.fn().mockResolvedValue(undefined);
    stop = vi.fn(async () => {
      this.snapshot.phase = 'completed';
    });
    constructor() {
      mocks.sessions.push(this);
    }
  },
}));

const events = new EventEmitter();
const handlers = new Map<
  string,
  (event: unknown, payload: unknown) => unknown
>();
const settle = async () => {
  for (let index = 0; index < 12; index++) await Promise.resolve();
};
const start = () =>
  handlers.get(channels.start)?.(
    { sender, senderFrame: sender.mainFrame },
    {
      name: 'Synthetic capture',
      quality: '720p',
      inputs: [
        { id: 'one', name: 'Synthetic', kind: 'device', videoCodec: 'h264' },
      ],
    },
  );

beforeEach(() => {
  vi.clearAllMocks();
  events.removeAllListeners();
  handlers.clear();
  mocks.sessions.length = 0;
  mocks.save.mockResolvedValue({
    canceled: false,
    filePath: '/synthetic.stpkg',
  });
  mocks.handle.mockImplementation((channel, handler) =>
    handlers.set(channel, handler),
  );
  mocks.app.on.mockImplementation((event, callback) =>
    events.on(event, callback),
  );
  mocks.app.quit.mockImplementation(() => {
    events.emit('before-quit', { preventDefault: vi.fn() });
  });
  mocks.send.mockImplementation((channel) => {
    // Model MediaRecorder acknowledging the stop request before Main finalizes.
    if (channel === channels.stopRequested)
      mocks.sessions.at(-1)!.snapshot.phase = 'stopping';
  });
  registerLiveCaptureHandlers({ openPackage: vi.fn() });
});

it('stops a new recording after a previous stopped recording quit was cancelled by Timeline', async () => {
  events.on('before-quit', (event) => event.preventDefault());
  await start();
  mocks.app.quit();
  await settle();
  expect(mocks.sessions[0].stop).toHaveBeenCalledOnce();
  expect(mocks.app.quit).toHaveBeenCalledTimes(2);
  await start();
  mocks.app.quit();
  await settle();
  expect(mocks.sessions[1].stop).toHaveBeenCalledOnce();
  expect(
    mocks.send.mock.calls.filter(
      ([channel]) => channel === channels.stopRequested,
    ),
  ).toHaveLength(2);
  expect(mocks.app.quit).toHaveBeenCalledTimes(4);
  const lifecycle = mocks.lifecycle.mock.calls[0][0];
  expect(lifecycle.canClose()).toBe(true);
});

it('retains the capture owner while startup is pending, then stops on a later quit', async () => {
  const picker = Promise.withResolvers<{
    canceled: boolean;
    filePath: string;
  }>();
  mocks.save.mockReturnValue(picker.promise);
  const starting = start();
  mocks.app.quit();
  await settle();
  expect(mocks.sessions).toHaveLength(0);
  expect(mocks.app.quit).toHaveBeenCalledOnce();
  expect(mocks.lifecycle.mock.calls[0][0].canClose()).toBe(false);
  picker.resolve({ canceled: false, filePath: '/synthetic.stpkg' });
  await starting;
  mocks.app.quit();
  await settle();
  expect(mocks.sessions[0].stop).toHaveBeenCalledOnce();
});

it('keeps the app alive on stop failure and permits a later stop retry', async () => {
  await start();
  mocks.sessions[0].stop.mockRejectedValueOnce(
    new Error('synthetic stop failure'),
  );
  mocks.app.quit();
  await settle();
  expect(mocks.app.quit).toHaveBeenCalledOnce();
  mocks.app.quit();
  await settle();
  expect(mocks.sessions[0].stop).toHaveBeenCalledTimes(2);
  expect(mocks.app.quit).toHaveBeenCalledTimes(3);
});
