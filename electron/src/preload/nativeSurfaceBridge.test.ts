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

it('rejects queued and late old images synchronously while the old apply is pending', async () => {
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
  surface.prepare('owner', 2);
  expect(old.release).toHaveBeenCalledOnce();
  expect(electron.send).toHaveBeenCalledWith('diagnostic-surface-drawn', {
    document: 'doc',
    id: 1,
    drawn: false,
  });
  // An earlier Renderer writer can enter apply after prepare has already run.
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
  expect(() => surface.prepare('another', 3)).toThrow(
    'surface owner unavailable',
  );
  detach();
  expect(() => surface.prepare('owner', 3)).toThrow(
    'surface owner unavailable',
  );
  expect(old.release).toHaveBeenCalledOnce();
  expect(current.release).toHaveBeenCalledOnce();
});
