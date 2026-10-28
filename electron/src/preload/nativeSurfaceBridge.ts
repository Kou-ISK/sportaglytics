/// <reference lib="dom" />
import { createAdmission } from './nativeSurfaceAdmission';
import { ipcRenderer, sharedTexture } from 'electron';
interface Metadata {
  document: string;
  id: number;
  generation: string;
  nativeGeneration: number;
  seekId: number;
  pts: number;
}
interface Pending {
  texture: Electron.SharedTextureImported;
  meta: Metadata;
}
export function createSurfaceBridge(): {
  bind: (id: string, onFrame: (meta: Metadata) => void) => () => void;
  expect: (generation: string, seekId: number) => void;
  close: () => void;
  stats: () => Record<string, unknown>;
} {
  let canvas: HTMLCanvasElement | null = null,
    callback: ((meta: Metadata) => void) | null = null,
    expected: { generation: string; seekId: number } | null = null,
    pending: Pending | null = null,
    animation = 0,
    demandAnimation = 0,
    documentKey: string | null = null,
    closed = false;
  let admission = createAdmission();
  const frames: Record<string, unknown>[] = [];
  let discarded = 0,
    frameCount = 0;
  const ack = (p: Pending, drawn: boolean): void => {
    try {
      ipcRenderer.send('diagnostic-surface-drawn', {
        document: p.meta.document,
        id: p.meta.id,
        drawn,
      });
    } finally {
      p.texture.release();
    }
  };
  const disposePending = (): void => {
    if (pending) {
      const value = pending;
      pending = null;
      discarded++;
      ack(value, false);
    }
  };
  const matches = (m: Metadata): boolean => Boolean(admission.current(m));
  sharedTexture.setSharedTextureReceiver(
    async ({ importedSharedTexture }, raw: unknown) => {
      if (
        !raw ||
        typeof raw !== 'object' ||
        !('id' in raw) ||
        !('generation' in raw) ||
        !('seekId' in raw) ||
        !('pts' in raw) ||
        !('document' in raw) ||
        !('nativeGeneration' in raw) ||
        typeof raw.document !== 'string' ||
        typeof raw.generation !== 'string' ||
        typeof raw.pts !== 'number' ||
        !Number.isSafeInteger(raw.pts) ||
        raw.pts < 0 ||
        ![raw.id, raw.seekId, raw.nativeGeneration].every(
          (n) => typeof n === 'number' && Number.isSafeInteger(n) && n > 0,
        )
      ) {
        importedSharedTexture.release();
        return;
      }
      const meta: Metadata = {
        document: raw.document,
        id: Number(raw.id),
        generation: raw.generation,
        nativeGeneration: Number(raw.nativeGeneration),
        seekId: Number(raw.seekId),
        pts: Number(raw.pts),
      };
      const next = { texture: importedSharedTexture, meta };
      if (!matches(meta) || !canvas) {
        ack(next, false);
        discarded++;
        return;
      }
      documentKey ??= meta.document;
      disposePending();
      pending = next;
      if (animation) return;
      animation = requestAnimationFrame(() => {
        animation = 0;
        const p = pending;
        pending = null;
        if (!p) return;
        let frame: VideoFrame | null = null,
          drawn = false;
        try {
          if (matches(p.meta) && canvas) {
            const ctx = canvas.getContext('2d');
            if (!ctx) throw Error('surface canvas unavailable');
            frame = p.texture.getVideoFrame();
            if (!canvas.isConnected) throw Error('surface canvas detached');
            ctx.drawImage(frame, 0, 0, canvas.width, canvas.height);
            callback?.(p.meta);
            drawn = admission.commit(p.meta);
            const record = { ...p.meta, drawnAt: performance.now() };
            if (frames.length < 2400) frames.push(record);
            else frames[frameCount % 2400] = record;
            frameCount++;
          }
        } catch (e) {
          ipcRenderer.send('diagnostic-surface-error', String(e));
        } finally {
          frame?.close();
          ack(p, drawn);
        }
      });
    },
  );
  const stop = (): void => {
    closed = true;
    admission.close();
    expected = null;
    if (demandAnimation) cancelAnimationFrame(demandAnimation);
    demandAnimation = 0;
    if (animation) cancelAnimationFrame(animation);
    animation = 0;
    disposePending();
  };
  const request = (): void => {
    if (closed || !canvas) return;
    if (documentKey)
      ipcRenderer.send('diagnostic-surface-request', documentKey);
    demandAnimation = requestAnimationFrame(request);
  };
  return {
    bind: (id, onFrame) => {
      if (canvas) throw Error('surface already bound');
      const target = document.getElementById(id);
      if (
        !(target instanceof HTMLCanvasElement) ||
        target.width !== 1920 ||
        target.height !== 1080
      )
        throw Error('invalid qualified canvas');
      canvas = target;
      callback = onFrame;
      return () => {
        stop();
        canvas = null;
        callback = null;
      };
    },
    expect: (generation, seekId) => {
      // Never let a stale command restore admission for an older image.
      // Ignore only the stale admission update; Main still validates its input.
      if (expected?.generation === generation && seekId < expected.seekId)
        return;
      if (!canvas) throw Error('surface not bound');
      if (expected?.generation !== generation) {
        stop();
        admission = createAdmission();
        closed = false;
        documentKey = null;
        discarded = 0;
        frameCount = 0;
        frames.length = 0;
      }
      expected = { generation, seekId };
      admission.expect(generation, seekId);
      if (pending && !matches(pending.meta)) disposePending();
      if (!demandAnimation) demandAnimation = requestAnimationFrame(request);
    },
    close: stop,
    stats: () => ({
      frames:
        frameCount <= 2400
          ? frames
          : [
              ...frames.slice(frameCount % 2400),
              ...frames.slice(0, frameCount % 2400),
            ],
      frameCount,
      traceTruncated: frameCount > 2400,
      discarded,
      pending: Boolean(pending),
      closed,
    }),
  };
}
