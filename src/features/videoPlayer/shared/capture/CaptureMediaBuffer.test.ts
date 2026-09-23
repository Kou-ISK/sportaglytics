import { afterEach, expect, it, vi } from 'vitest';
import type { PackageMediaClip } from '../../../../types/package/media';
import { CaptureMediaBuffer } from './CaptureMediaBuffer';
vi.mock('./mp4Codec', () => ({
  captureMp4MimeType: () => 'video/mp4; codecs="avc1.640028"',
}));
afterEach(() => vi.unstubAllGlobals());

class BufferFixture extends EventTarget {
  start = 0;
  end = 0;
  timestampOffset = 0;
  appendWindowStart = 0;
  appendWindowEnd = Infinity;
  updating = false;
  get buffered(): TimeRanges {
    return {
      length: this.end > this.start ? 1 : 0,
      start: () => this.start,
      end: () => this.end,
    };
  }
  appendBuffer(): void {
    if (!this.end) this.start = this.timestampOffset;
    this.end = Math.max(this.end, this.timestampOffset + 2);
    queueMicrotask(() => this.dispatchEvent(new Event('updateend')));
  }
  remove(start: number, end: number): void {
    if (start === 0) this.start = Math.min(end, this.end);
    queueMicrotask(() => this.dispatchEvent(new Event('updateend')));
  }
}
const setup = (): { source: MediaSource; buffer: BufferFixture } => {
  const buffer = new BufferFixture();
  const source = Object.assign(new EventTarget(), {
    readyState: 'open',
    duration: 0,
    addSourceBuffer: () => buffer,
  });
  vi.stubGlobal('MediaSource', { isTypeSupported: () => true });
  // The fixture implements exactly the MediaSource subset owned by this adapter.
  return { source: source as unknown as MediaSource, buffer };
};
const clips: PackageMediaClip[] = Array.from({ length: 10000 }, (_, index) => ({
  id: String(index),
  source: `media/${index}.mp4`,
  sourceKind: 'local',
  timelineStartSeconds: index * 2,
  durationSeconds: 2,
  gapBeforeSeconds: 0,
}));
it('reads only the nearby interval of a long recording, evicts old data, and reloads past reviews', async () => {
  const { source, buffer } = setup();
  const read = vi.fn(
    async (_path: string, _signal: AbortSignal) => new ArrayBuffer(8),
  );
  const error = vi.fn();
  const controller = new CaptureMediaBuffer(source, read, error);
  controller.update(clips, 120);
  await vi.waitFor(() => expect(read).toHaveBeenCalledTimes(6));
  expect(read.mock.calls.map((call) => call[0])).toEqual(
    clips.slice(60, 66).map((clip) => clip.source),
  );
  await new Promise((resolve) => setTimeout(resolve, 0));
  controller.update(clips, 200);
  await vi.waitFor(() => expect(read).toHaveBeenCalledTimes(12));
  expect(buffer.start).toBeGreaterThanOrEqual(130);
  await new Promise((resolve) => setTimeout(resolve, 0));
  controller.update(clips, 10);
  await vi.waitFor(() => expect(read).toHaveBeenCalledTimes(18));
  expect(error).not.toHaveBeenCalled();
  controller.dispose();
  controller.update(clips, 300);
  expect(read).toHaveBeenCalledTimes(18);
});
it('reports read/append failure once without continuing allocation', async () => {
  const { source } = setup();
  const error = vi.fn();
  const read = vi.fn(async () => {
    throw new Error('unavailable');
  });
  const controller = new CaptureMediaBuffer(source, read, error);
  controller.update(clips, 0);
  await vi.waitFor(() => expect(error).toHaveBeenCalledTimes(1));
  controller.update(clips, 20);
  expect(read).toHaveBeenCalledTimes(1);
});
