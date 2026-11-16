// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { createNativeGroupPresenter } from './nativeGroupPresenter';
import type { NativeGroupSurfaceMetadata } from '../../../src/types/ipc/nativeGroupSurface';

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const meta = (
  angle: number,
  pair = 1,
  operation = 1,
): NativeGroupSurfaceMetadata => ({
  version: 2,
  document: 'document',
  generation: 'owner',
  operation,
  seekId: operation,
  pair,
  id: pair * 2 - 1 + angle,
  angle,
  sourceEpoch: 1,
  sourceIndex: angle,
  sourcePTS: 600000 + angle * 60000,
  sourceEndPTS: 602002 + angle * 60000,
  globalTicks: 600000,
  globalStart: 600000,
  globalEnd: 602002,
  content: 'image',
});
const setup = () => {
  let next = 0;
  const callbacks = new Map<number, FrameRequestCallback>();
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callbacks.set(++next, callback);
    return next;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => callbacks.delete(id));
  const contexts = ['left', 'right'].map(() => ({
    drawImage: vi.fn(),
    fillRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    globalCompositeOperation: 'source-over',
    fillStyle: '',
  }));
  const canvases = ['left', 'right'].map((id) => {
    const canvas = document.createElement('canvas');
    canvas.id = id;
    canvas.width = 1920;
    canvas.height = 1080;
    document.body.append(canvas);
    return canvas;
  });
  canvases.forEach((canvas, index) =>
    vi
      .spyOn(canvas, 'getContext')
      .mockReturnValue(contexts[index] as unknown as CanvasRenderingContext2D),
  );
  const output = { acknowledge: vi.fn(), failure: vi.fn(), request: vi.fn() },
    shown = vi.fn();
  const presenter = createNativeGroupPresenter(output);
  const unbind = presenter.bind(['left', 'right'], shown);
  presenter.expect('owner', 1, 1);
  const paint = (): void => {
    const current = [...callbacks.values()];
    callbacks.clear();
    current.forEach((callback) => callback(1));
  };
  const texture = () => {
    const frame = { close: vi.fn() };
    return { release: vi.fn(), getVideoFrame: vi.fn(() => frame), frame };
  };
  return {
    presenter,
    output,
    shown,
    contexts,
    canvases,
    paint,
    texture,
    unbind,
  };
};

it('waits for distinct angles at a common global anchor, acquiring both frames before drawing either', () => {
  const s = setup(),
    a = s.texture(),
    b = s.texture();
  s.presenter.receive(meta(0), a);
  s.paint();
  expect(s.contexts[0].drawImage).not.toHaveBeenCalled();
  s.presenter.receive(meta(1), b);
  s.paint();
  expect(s.contexts[0].drawImage).toHaveBeenCalledExactlyOnceWith(
    a.frame,
    0,
    0,
    1920,
    1080,
  );
  expect(s.contexts[1].drawImage).toHaveBeenCalledExactlyOnceWith(
    b.frame,
    0,
    0,
    1920,
    1080,
  );
  expect(
    Math.max(
      a.getVideoFrame.mock.invocationCallOrder[0],
      b.getVideoFrame.mock.invocationCallOrder[0],
    ),
  ).toBeLessThan(s.contexts[0].drawImage.mock.invocationCallOrder[0]);
  expect(s.shown).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({ pair: 1, globalTicks: 600000, ids: [1, 2] }),
  );
  expect(a.release).toHaveBeenCalledOnce();
  expect(b.release).toHaveBeenCalledOnce();
  expect(s.output.acknowledge.mock.calls.map(([, drawn]) => drawn)).toEqual([
    true,
    true,
  ]);
  s.unbind();
});
it('keeps an intermediate complete pair when another pair arrives before its RAF', () => {
  const s = setup();
  for (const pair of [1, 2])
    for (const angle of [0, 1])
      s.presenter.receive(meta(angle, pair), s.texture());
  s.paint();
  expect(s.shown.mock.calls.map(([value]) => value.pair)).toEqual([1]);
  s.paint();
  expect(s.shown.mock.calls.map(([value]) => value.pair)).toEqual([1, 2]);
  s.unbind();
});
it('discards unpainted images on release/new intent; a late issued transfer never paints into the new operation', () => {
  const s = setup(),
    a = s.texture(),
    b = s.texture(),
    late = s.texture();
  s.presenter.receive(meta(0), a);
  s.presenter.receive(meta(1), b);
  s.presenter.close();
  s.paint();
  expect(s.shown).not.toHaveBeenCalled();
  expect(a.release).toHaveBeenCalledOnce();
  expect(b.release).toHaveBeenCalledOnce();
  s.presenter.expect('new-owner', 1, 1);
  s.presenter.receive(meta(0, 2), late);
  s.paint();
  expect(late.release).toHaveBeenCalledOnce();
  expect(s.shown).not.toHaveBeenCalled();
  s.unbind();
});
it('clears a real blank opaquely without a texture and keeps source PTS separate from the common timeline', () => {
  const s = setup();
  s.presenter.receive(meta(0), s.texture());
  s.presenter.receive(
    {
      ...meta(1),
      content: 'blank',
      sourceIndex: 32,
      sourcePTS: 0,
      sourceEndPTS: 0,
    },
    null,
  );
  s.paint();
  expect(s.contexts[1].drawImage).not.toHaveBeenCalled();
  expect(s.contexts[1].fillRect).toHaveBeenCalledWith(0, 0, 1920, 1080);
  expect(s.contexts[1].fillStyle).toBe('#000');
  expect(s.shown).toHaveBeenCalledOnce();
  s.unbind();
});
it('fails a mismatched pair without treating the other angle as its completion', () => {
  const s = setup(),
    a = s.texture(),
    b = s.texture();
  s.presenter.receive(meta(0), a);
  s.presenter.receive({ ...meta(1), globalTicks: 600001 }, b);
  s.paint();
  expect(s.output.failure).toHaveBeenCalledOnce();
  expect(s.shown).not.toHaveBeenCalled();
  expect(a.release).toHaveBeenCalledOnce();
  expect(b.release).toHaveBeenCalledOnce();
  s.unbind();
});
it('fails before either canvas changes if frame acquisition fails, and releases both loans', () => {
  const s = setup(),
    a = s.texture(),
    b = s.texture();
  b.getVideoFrame.mockImplementation(() => {
    throw Error('GPU');
  });
  s.presenter.receive(meta(0), a);
  s.presenter.receive(meta(1), b);
  s.paint();
  expect(s.output.failure).toHaveBeenCalledOnce();
  expect(s.contexts[0].drawImage).not.toHaveBeenCalled();
  expect(a.frame.close).toHaveBeenCalledOnce();
  expect(a.release).toHaveBeenCalledOnce();
  expect(b.release).toHaveBeenCalledOnce();
  s.unbind();
});
it('does not claim a pair receipt after a canvas draw fails part way through presentation', () => {
  const s = setup();
  s.contexts[1].drawImage.mockImplementation(() => {
    throw Error('draw');
  });
  s.presenter.receive(meta(0), s.texture());
  s.presenter.receive(meta(1), s.texture());
  s.paint();
  expect(s.presenter.current()).toBeNull();
  expect(s.shown).not.toHaveBeenCalled();
  expect(s.output.failure).toHaveBeenCalledOnce();
  expect(s.output.acknowledge.mock.calls.map(([, drawn]) => drawn)).toEqual([
    false,
    false,
  ]);
  s.unbind();
});
it('bounds incomplete pairs and rejects reusing one canvas as two independent views', () => {
  const s = setup(),
    textures = [1, 2, 3, 4].map(() => s.texture());
  textures.forEach((texture, index) =>
    s.presenter.receive(meta(0, index + 1), texture),
  );
  expect(s.output.failure).toHaveBeenCalledOnce();
  textures.forEach((texture) => expect(texture.release).toHaveBeenCalledOnce());
  s.unbind();
  expect(() => s.presenter.bind(['left', 'left'], s.shown)).toThrow(
    'GROUP_CANVAS_BINDING',
  );
});
it('returns an isolated presented receipt; a new operation does not invent a new displayed position', () => {
  const s = setup();
  s.presenter.receive(meta(0), s.texture());
  s.presenter.receive(meta(1), s.texture());
  s.paint();
  const current = s.presenter.current();
  if (!current) throw Error('no receipt');
  current.globalTicks = 1;
  s.presenter.expect('owner', 2, 2);
  expect(s.presenter.current()?.globalTicks).toBe(600000);
  expect(s.presenter.current()?.operation).toBe(1);
  s.unbind();
});

it('releases an incomplete prior clip pair when one angle changes source epoch', () => {
  const s = setup(),
    old = s.texture();
  s.presenter.receive(meta(0), old);
  s.presenter.receive(
    { ...meta(0, 2), sourceEpoch: 2, sourceIndex: 2 },
    s.texture(),
  );
  expect(old.release).toHaveBeenCalledOnce();
  s.presenter.receive(meta(1, 2), s.texture());
  s.paint();
  expect(s.shown).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({ pair: 2, ids: [3, 4] }),
  );
  expect(s.output.failure).not.toHaveBeenCalled();
  s.unbind();
});

it('continues disposing all loans after an uncertain release, and cannot revive that failed generation', () => {
  const s = setup(),
    a = s.texture(),
    b = s.texture();
  s.presenter.receive(meta(0), a);
  s.presenter.receive(meta(1), b);
  a.release.mockImplementation(() => {
    throw Error('release unknown');
  });
  s.presenter.close();
  expect(a.release).toHaveBeenCalledOnce();
  expect(b.release).toHaveBeenCalledOnce();
  expect(s.output.failure).toHaveBeenCalledOnce();
  expect(() => s.presenter.expect('owner', 2, 2)).toThrow(
    'GROUP_PRESENTATION_FAILED',
  );
  expect(() => s.presenter.expect('new-owner', 1, 1)).not.toThrow();
  s.unbind();
});

it('a callback cannot rewrite the recorded displayed receipt', () => {
  const s = setup();
  s.shown.mockImplementation((value) => {
    value.globalTicks = 99;
    value.ids[0] = 99;
  });
  s.presenter.receive(meta(0), s.texture());
  s.presenter.receive(meta(1), s.texture());
  s.paint();
  expect(s.presenter.current()).toMatchObject({
    globalTicks: 600000,
    ids: [1, 2],
  });
  s.unbind();
});

it('a failing frame close does not skip closing the other frame or releasing either import', () => {
  const s = setup(),
    a = s.texture(),
    b = s.texture();
  a.frame.close.mockImplementation(() => {
    throw Error('frame close');
  });
  s.presenter.receive(meta(0), a);
  s.presenter.receive(meta(1), b);
  s.paint();
  expect(a.frame.close).toHaveBeenCalledOnce();
  expect(b.frame.close).toHaveBeenCalledOnce();
  expect(a.release).toHaveBeenCalledOnce();
  expect(b.release).toHaveBeenCalledOnce();
  expect(s.output.failure).toHaveBeenCalledOnce();
  s.unbind();
});

it('an old unbind cannot revoke a later binding even when it reuses the same canvases', () => {
  const s = setup();
  s.unbind();
  const release = s.presenter.bind(['left', 'right'], s.shown);
  s.presenter.expect('new-owner', 1, 1);
  s.unbind();
  for (const angle of [0, 1])
    s.presenter.receive(
      { ...meta(angle), generation: 'new-owner' },
      s.texture(),
    );
  s.paint();
  expect(s.shown).toHaveBeenCalledOnce();
  release();
});
