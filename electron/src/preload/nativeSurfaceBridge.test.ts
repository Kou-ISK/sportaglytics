// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { createSurfaceBridge } from './nativeSurfaceBridge';

const electron = vi.hoisted(() => ({
  send: vi.fn(),
  receive: vi.fn(),
  on: vi.fn(),
}));
vi.mock('electron', () => ({
  ipcRenderer: { send: electron.send, on: electron.on },
  sharedTexture: { setSharedTextureReceiver: electron.receive },
}));
afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

it('connects Main drainage to pending group texture release even when RAF never runs', async () => {
  vi.stubGlobal('requestAnimationFrame', () => 1);
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  for (const id of ['left', 'right']) {
    const canvas = document.createElement('canvas'); canvas.id = id;
    canvas.width = 1920; canvas.height = 1080; document.body.append(canvas);
  }
  const surface = createSurfaceBridge();
  surface.group.bind(['left', 'right'], vi.fn());
  surface.group.expect('owner', 1, 1);
  const receive = electron.receive.mock.calls[0][0];
  const drain = electron.on.mock.calls.find(([channel]) => channel === 'native-group-surface-drain')?.[1];
  if (typeof receive !== 'function' || typeof drain !== 'function') throw Error('drain not connected');
  const texture = { release: vi.fn(), getVideoFrame: vi.fn() };
  await receive({ importedSharedTexture: texture }, { version: 2, document: 'doc', generation: 'owner',
    operation: 1, seekId: 1, pair: 1, id: 1, angle: 0, sourceEpoch: 1, sourceIndex: 0,
    sourcePTS: 600000, sourceEndPTS: 602002, globalTicks: 600000,
    globalStart: 600000, globalEnd: 602002, content: 'image' });
  expect(texture.release).not.toHaveBeenCalled();
  drain({}, { generation: 'foreign', document: 'doc' });
  expect(texture.release).not.toHaveBeenCalled();
  drain({}, { generation: 'owner', document: 'doc' });
  expect(texture.release).toHaveBeenCalledOnce();
  expect(texture.getVideoFrame).not.toHaveBeenCalled();
  expect(electron.send).toHaveBeenCalledWith('native-group-surface-drawn', { document: 'doc', id: 1, drawn: false });
  surface.close(); expect(texture.release).toHaveBeenCalledOnce();
});

it('routes group and blank delivery through the same global texture receiver without legacy ACKs', async () => {
  const callbacks = new Map<number, FrameRequestCallback>();
  let serial = 0;
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callbacks.set(++serial, callback);
    return serial;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => callbacks.delete(id));
  const draw = vi.fn(),
    fill = vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    drawImage: draw,
    fillRect: fill,
    save: vi.fn(),
    restore: vi.fn(),
  } as unknown as CanvasRenderingContext2D);
  for (const id of ['left', 'right']) {
    const canvas = document.createElement('canvas');
    canvas.id = id;
    canvas.width = 1920;
    canvas.height = 1080;
    document.body.append(canvas);
  }
  const surface = createSurfaceBridge(),
    shown = vi.fn();
  const unbind = surface.group.bind(['left', 'right'], shown);
  expect(() => surface.bind('left', vi.fn())).toThrow('already bound');
  surface.group.expect('group-owner', 1, 1);
  expect(electron.receive).toHaveBeenCalledOnce();
  const receive = electron.receive.mock.calls[0][0];
  const blank = electron.on.mock.calls.find(
    ([channel]) => channel === 'native-group-surface-blank',
  )?.[1];
  if (typeof receive !== 'function' || typeof blank !== 'function')
    throw Error('receiver not connected');
  const meta = {
    version: 2,
    document: 'doc',
    generation: 'group-owner',
    id: 1,
    operation: 1,
    seekId: 1,
    pair: 1,
    angle: 0,
    sourceEpoch: 1,
    sourceIndex: 0,
    sourcePTS: 600000,
    sourceEndPTS: 602002,
    globalTicks: 600000,
    globalStart: 600000,
    globalEnd: 602002,
    content: 'image',
  };
  const texture = {
    release: vi.fn(),
    getVideoFrame: () => ({ close: vi.fn() }),
  };
  await receive({ importedSharedTexture: texture }, meta);
  blank(
    {},
    {
      ...meta,
      id: 2,
      angle: 1,
      sourceIndex: 32,
      sourcePTS: 0,
      sourceEndPTS: 0,
      content: 'blank',
    },
  );
  const pending = [...callbacks.values()];
  callbacks.clear();
  pending.forEach((callback) => callback(0));
  expect(draw).toHaveBeenCalledOnce();
  expect(fill).toHaveBeenCalledOnce();
  expect(shown).toHaveBeenCalledOnce();
  expect(texture.release).toHaveBeenCalledOnce();
  expect(
    electron.send.mock.calls.filter(
      ([channel]) => channel === 'native-group-surface-drawn',
    ),
  ).toHaveLength(2);
  expect(
    electron.send.mock.calls.filter(
      ([channel]) => channel === 'diagnostic-surface-drawn',
    ),
  ).toHaveLength(0);
  unbind();
});

it('a document close drains unpainted group images and a repeated old unbind cannot remove a new binding', async () => {
  const callbacks = new Map<number, FrameRequestCallback>();
  let serial = 0;
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callbacks.set(++serial, callback);
    return serial;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => callbacks.delete(id));
  for (const id of ['left', 'right']) {
    const canvas = document.createElement('canvas');
    canvas.id = id;
    canvas.width = 1920;
    canvas.height = 1080;
    document.body.append(canvas);
  }
  const surface = createSurfaceBridge(),
    shown = vi.fn();
  const first = surface.group.bind(['left', 'right'], shown);
  surface.group.expect('owner', 1, 1);
  const receive = electron.receive.mock.calls[0][0];
  const texture = { release: vi.fn(), getVideoFrame: vi.fn() };
  await receive(
    { importedSharedTexture: texture },
    {
      version: 2,
      document: 'doc',
      generation: 'owner',
      id: 1,
      operation: 1,
      seekId: 1,
      pair: 1,
      angle: 0,
      sourceEpoch: 1,
      sourceIndex: 0,
      sourcePTS: 600000,
      sourceEndPTS: 602002,
      globalTicks: 600000,
      globalStart: 600000,
      globalEnd: 602002,
      content: 'image',
    },
  );
  surface.close();
  expect(texture.release).toHaveBeenCalledOnce();
  expect(callbacks.size).toBe(0);
  first();
  const second = surface.group.bind(['left', 'right'], shown);
  first();
  expect(() => surface.bind('left', vi.fn())).toThrow('already bound');
  second();
  const legacy = surface.bind('left', vi.fn());
  legacy();
  const newer = surface.bind('left', vi.fn());
  legacy();
  expect(() => surface.bind('right', vi.fn())).toThrow('already bound');
  newer();
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
