/// <reference lib="dom" />
import { parseNativeGroupSurfaceMetadata } from '../../../src/types/ipc/nativeGroupSurface';
import type {
  NativeGroupPresentation as GroupPresentation,
  NativeGroupSurfaceMetadata,
} from '../../../src/types/ipc/nativeGroupSurface';
interface Item {
  meta: NativeGroupSurfaceMetadata;
  texture: Electron.SharedTextureImported | null;
}
interface Pair {
  first: Item | null;
  second: Item | null;
}
interface Output {
  acknowledge(meta: NativeGroupSurfaceMetadata, drawn: boolean): void;
  failure(): void;
  request(document: string): void;
}

/** One document-local presenter, delegated from the single Electron receiver.
 * Both frame objects are acquired before either canvas is changed. Canvas calls
 * share one RAF, which is not a claim of atomic physical scanout. */
export const createNativeGroupPresenter = (
  output: Output,
): {
  bind(
    ids: readonly [string, string],
    shown: (value: GroupPresentation) => void,
  ): () => void;
  expect(generation: string, operation: number, seekId: number): void;
  receive(raw: unknown, texture: Electron.SharedTextureImported | null): void;
  close(): void;
  current(): GroupPresentation | null;
} => {
  let targets: readonly [HTMLCanvasElement, HTMLCanvasElement] | null = null;
  let binding: object | null = null;
  let listener: ((value: GroupPresentation) => void) | null = null;
  let owner: { generation: string; operation: number; seekId: number } | null =
    null;
  let documentKey: string | null = null,
    animation = 0,
    demand = 0;
  let stopped = true,
    failed = false,
    lastPair = 0,
    lastId = 0;
  let current: GroupPresentation | null = null;
  let failedGeneration: string | null = null;
  let lastGeneration: string | null = null;
  const pending = new Map<number, Pair>();
  const epochs = [0, 0];
  const finish = (item: Item, drawn: boolean): void => {
    let error: unknown;
    try {
      output.acknowledge(item.meta, drawn);
    } catch (cause) {
      error = cause;
    }
    try {
      item.texture?.release();
    } catch (cause) {
      error ??= cause;
    }
    if (error) fail();
  };
  const discard = (pair: Pair): void => {
    if (pair.first) finish(pair.first, false);
    if (pair.second) finish(pair.second, false);
  };
  const clear = (): void => {
    const old = [...pending.values()];
    pending.clear();
    for (const pair of old) {
      for (const item of [pair.first, pair.second]) {
        if (item) finish(item, false);
      }
    }
  };
  const close = (): void => {
    stopped = true;
    owner = null;
    if (animation) cancelAnimationFrame(animation);
    if (demand) cancelAnimationFrame(demand);
    animation = demand = 0;
    clear();
  };
  const fail = (): void => {
    if (failed) return;
    failed = true;
    failedGeneration = lastGeneration;
    try {
      close();
    } finally {
      try {
        output.failure();
      } catch {
        /* No alternate channel or repeated send. */
      }
    }
  };
  const matches = (meta: NativeGroupSurfaceMetadata): boolean =>
    !stopped &&
    !!targets &&
    !!owner &&
    meta.generation === owner.generation &&
    meta.operation === owner.operation &&
    meta.seekId === owner.seekId &&
    (!documentKey || documentKey === meta.document);
  const paint = (): void => {
    animation = 0;
    if (stopped || !targets) return;
    // Choose the earliest complete pair. A newer half must not stand in for the
    // missing angle, nor replace a complete intermediate pair before paint.
    const entry = [...pending.entries()].find(
      ([, pair]) => pair.first && pair.second,
    );
    if (!entry) return;
    const [number, pair] = entry,
      a = pair.first,
      b = pair.second;
    if (!a || !b) return;
    pending.delete(number);
    let af: VideoFrame | null = null,
      bf: VideoFrame | null = null;
    let drawn = false;
    try {
      if (!matches(a.meta) || !matches(b.meta) || number <= lastPair) return;
      const [left, right] = targets;
      if (!left.isConnected || !right.isConnected)
        throw Error('GROUP_CANVAS_DETACHED');
      const lc = left.getContext('2d'),
        rc = right.getContext('2d');
      if (!lc || !rc) throw Error('GROUP_CANVAS_CONTEXT');
      af = a.texture?.getVideoFrame() ?? null;
      bf = b.texture?.getVideoFrame() ?? null;
      for (const [ctx, canvas, frame] of [
        [lc, left, af],
        [rc, right, bf],
      ] as const) {
        if (frame) ctx.drawImage(frame, 0, 0, canvas.width, canvas.height);
        else {
          // Opaque media blank: transparent clear would reveal an old HTML image.
          ctx.save();
          try {
            ctx.globalCompositeOperation = 'copy';
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          } finally {
            ctx.restore();
          }
        }
      }
      const receipt: GroupPresentation = {
        document: a.meta.document,
        generation: a.meta.generation,
        operation: a.meta.operation,
        seekId: a.meta.seekId,
        pair: number,
        globalTicks: a.meta.globalTicks,
        ids: [a.meta.id, b.meta.id],
      };
      lastPair = number;
      current = { ...receipt, ids: [...receipt.ids] };
      drawn = true;
      listener?.(receipt);
    } catch {
      fail();
    } finally {
      for (const frame of [af, bf]) {
        try {
          frame?.close();
        } catch {
          fail();
        }
      }
      try {
        finish(a, drawn);
      } finally {
        finish(b, drawn);
      }
    }
    for (const [number, old] of pending) {
      if (number <= lastPair) {
        pending.delete(number);
        discard(old);
      }
    }
    if (
      !stopped &&
      [...pending.values()].some((pair) => pair.first && pair.second)
    )
      animation = requestAnimationFrame(paint);
  };
  const request = (): void => {
    demand = 0;
    if (stopped || !targets) return;
    if (documentKey) output.request(documentKey);
    demand = requestAnimationFrame(request);
  };
  return {
    bind: (ids, shown) => {
      if (targets || ids[0] === ids[1]) throw Error('GROUP_CANVAS_BINDING');
      const a = document.getElementById(ids[0]),
        b = document.getElementById(ids[1]);
      if (
        !(a instanceof HTMLCanvasElement) ||
        !(b instanceof HTMLCanvasElement) ||
        a.width !== 1920 ||
        a.height !== 1080 ||
        b.width !== 1920 ||
        b.height !== 1080
      )
        throw Error('GROUP_CANVAS_PROFILE');
      targets = [a, b];
      const token = {};
      binding = token;
      listener = shown;
      return () => {
        if (binding !== token) return;
        binding = null;
        try {
          close();
        } finally {
          targets = null;
          listener = null;
          current = null;
        }
      };
    },
    expect: (generation, operation, seekId) => {
      if (
        !targets ||
        !/^[\w-]{1,128}$/.test(generation) ||
        !Number.isSafeInteger(operation) ||
        operation < 1 ||
        !Number.isSafeInteger(seekId) ||
        seekId < 1
      )
        throw Error('GROUP_PRESENTATION_OWNER');
      if (failed && failedGeneration === generation)
        throw Error('GROUP_PRESENTATION_FAILED');
      if (
        owner?.generation === generation &&
        (operation < owner.operation || seekId < owner.seekId)
      )
        return;
      if (!owner || generation !== owner.generation) {
        close();
        documentKey = null;
        lastPair = lastId = 0;
        epochs.fill(0);
        current = null;
        failed = false;
      } else if (operation !== owner.operation || seekId !== owner.seekId)
        clear();
      owner = { generation, operation, seekId };
      lastGeneration = generation;
      stopped = false;
      if (!demand) demand = requestAnimationFrame(request);
    },
    receive: (raw, texture) => {
      let meta: NativeGroupSurfaceMetadata;
      try {
        meta = parseNativeGroupSurfaceMetadata(raw);
      } catch {
        try {
          texture?.release();
        } catch {
          /* Unconfirmed release is fatal; never retry the imported resource. */
        } finally {
          fail();
        }
        return;
      }
      const item = { meta, texture };
      if (!matches(meta)) {
        finish(item, false);
        return;
      }
      if (
        (meta.content === 'image') !== Boolean(texture) ||
        meta.id <= lastId ||
        meta.pair <= lastPair ||
        meta.sourceEpoch < epochs[meta.angle]
      ) {
        finish(item, false);
        fail();
        return;
      }
      documentKey ??= meta.document;
      if (meta.sourceEpoch > epochs[meta.angle]) {
        // A clip transition can invalidate an incomplete old pair. Its late
        // counterpart may already have been dropped by Main; do not retain its
        // first loan until the drain deadline or mix it with the new source.
        for (const [key, old] of pending) {
          const prior = meta.angle === 0 ? old.first : old.second;
          if (prior && prior.meta.sourceEpoch < meta.sourceEpoch) {
            pending.delete(key);
            discard(old);
          }
        }
      }
      if (failed) {
        finish(item, false);
        return;
      }
      const pair = pending.get(meta.pair) ?? { first: null, second: null };
      const previous = pair.first ?? pair.second;
      if (
        (meta.angle === 0 ? pair.first : pair.second) ||
        (previous &&
          (previous.meta.globalTicks !== meta.globalTicks ||
            previous.meta.operation !== meta.operation ||
            previous.meta.seekId !== meta.seekId)) ||
        (!pending.has(meta.pair) && pending.size >= 3)
      ) {
        finish(item, false);
        fail();
        return;
      }
      lastId = meta.id;
      epochs[meta.angle] = meta.sourceEpoch;
      if (meta.angle === 0) pair.first = item;
      else pair.second = item;
      pending.set(meta.pair, pair);
      if (!animation && pair.first && pair.second)
        animation = requestAnimationFrame(paint);
    },
    close,
    current: () => current && { ...current, ids: [...current.ids] },
  };
};
