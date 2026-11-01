// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { createSurfaceBridge } from './nativeSurfaceBridge';

const electron = vi.hoisted(() => ({
  send: vi.fn(),
  receive: vi.fn(),
}));
vi.mock('electron', () => ({
  ipcRenderer: { send: electron.send },
  sharedTexture: { setSharedTextureReceiver: electron.receive },
}));
afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

it('rejects queued and late old images when a newer seek is admitted', async () => {
  const callbacks = new Map<number, FrameRequestCallback>();
  let next = 0;
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callbacks.set(++next, callback);
    return next;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => callbacks.delete(id));
  const draw = vi.fn();
  // Only the canvas backend is synthetic; admission and texture disposal are real.
  const context = { drawImage: draw } as unknown as CanvasRenderingContext2D;
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context);
  const canvas = document.createElement('canvas');
  canvas.id = 'surface';
  canvas.width = 1920;
  canvas.height = 1080;
  document.body.append(canvas);
  const surface = createSurfaceBridge();
  const onFrame = vi.fn();
  const detach = surface.bind(canvas.id, onFrame);
  surface.expect('owner', 1);
  const receiver = electron.receive.mock.calls.at(-1)?.[0];
  if (typeof receiver !== 'function') throw Error('missing receiver');
  const texture = () => ({
    release: vi.fn(),
    getVideoFrame: vi.fn(() => ({ close: vi.fn() })),
  });
  const old = texture(),
    late = texture(),
    current = texture();
  const metadata = (id: number, seekId: number) => ({
    document: 'doc',
    generation: 'owner',
    nativeGeneration: 1,
    id,
    seekId,
    pts: 120000,
  });
  await receiver({ importedSharedTexture: old }, metadata(1, 1));
  expect(draw).not.toHaveBeenCalled();
  surface.expect('owner', 2);
  expect(old.release).toHaveBeenCalledOnce();
  expect(electron.send).toHaveBeenCalledWith('diagnostic-surface-drawn', {
    document: 'doc',
    id: 1,
    drawn: false,
  });
  // Stale admission cannot restore images from the earlier command.
  surface.expect('owner', 1);
  await receiver({ importedSharedTexture: late }, metadata(2, 1));
  expect(late.release).toHaveBeenCalledOnce();
  await receiver({ importedSharedTexture: current }, metadata(3, 2));
  const pending = [...callbacks.values()];
  callbacks.clear();
  for (const callback of pending) callback(0);
  expect(draw).toHaveBeenCalledOnce();
  expect(onFrame).toHaveBeenCalledExactlyOnceWith(metadata(3, 2));
  expect(current.release).toHaveBeenCalledOnce();
  expect(electron.send).toHaveBeenCalledWith('diagnostic-surface-drawn', {
    document: 'doc',
    id: 3,
    drawn: true,
  });
  detach();
  const afterClose = texture();
  await receiver({ importedSharedTexture: afterClose }, metadata(4, 2));
  expect(afterClose.release).toHaveBeenCalledOnce();
  expect(draw).toHaveBeenCalledOnce();
  expect(old.release).toHaveBeenCalledOnce();
  expect(current.release).toHaveBeenCalledOnce();
});

it('presents intermediate images when newer reverse input arrives after receipt but before paint', async () => {
  const { HeldSeekQueue } =
    await import('../../../src/shared/media/heldSeekQueue');
  const callbacks = new Map<number, FrameRequestCallback>();
  let next = 0;
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callbacks.set(++next, callback);
    return next;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => callbacks.delete(id));
  const draw = vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    drawImage: draw,
  } as unknown as CanvasRenderingContext2D);
  const canvas = document.createElement('canvas');
  canvas.id = 'reverse-surface';
  canvas.width = 1920;
  canvas.height = 1080;
  document.body.append(canvas);
  const surface = createSurfaceBridge();
  let seek = 0;
  let displayed = (): void => {};
  const shown: number[] = [];
  const release = surface.bind(canvas.id, (meta) => {
    shown.push(meta.pts);
    displayed();
  });
  const receiver = electron.receive.mock.calls.at(-1)![0];
  const issue = vi.fn(
    (time: number) =>
      new Promise<void>((resolve) => {
        surface.expect('reverse', ++seek, seek, 1);
        displayed = resolve;
        void receiver(
          {
            importedSharedTexture: {
              release: vi.fn(),
              getVideoFrame: () => ({ close: vi.fn() }),
            },
          },
          {
            document: 'doc',
            generation: 'reverse',
            nativeGeneration: seek,
            seekId: seek,
            id: seek,
            pts: time * 120000,
          },
        );
      }),
  );
  const queue = new HeldSeekQueue(issue, (error) => {
    throw error;
  });
  queue.request(10);
  queue.request(9);
  queue.request(8);
  expect(draw).not.toHaveBeenCalled();
  expect(issue).toHaveBeenCalledTimes(1);
  const paint = async (): Promise<void> => {
    const ready = [...callbacks.values()];
    callbacks.clear();
    ready.forEach((callback) => callback(0));
    for (let n = 0; n < 8; n++) await Promise.resolve();
  };
  await paint();
  expect(shown).toEqual([1200000]);
  expect(issue.mock.calls.map(([time]) => time)).toEqual([10, 8]);
  await paint();
  expect(shown).toEqual([1200000, 960000]);
  expect(draw).toHaveBeenCalledTimes(2);
  release();
});
