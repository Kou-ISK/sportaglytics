import { scrubTicksPerSecond } from '../../../../types/ipc/scrubPreview';
import type { ScrubPreviewStrip } from '../../../../types/ipc/scrubPreview';

export const findScrubFrame = (
  strip: ScrubPreviewStrip,
  time: number,
): ScrubPreviewStrip['frames'][number] | null => {
  const ticks = time * scrubTicksPerSecond;
  let low = 0,
    high = strip.frames.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (strip.frames[mid].pts <= ticks) low = mid + 1;
    else high = mid;
  }
  // The last packet has no following timestamp to prove its display interval.
  return low > 0 && low < strip.frames.length ? strip.frames[low - 1] : null;
};

// createImageBitmap cannot be cancelled. Keep one slot per renderer until the
// actual operation settles, including across a gesture or source replacement.
let drawing = false;

/** Presentation only. The original media element owns audio and the playback clock. */
export class ScrubPreviewLayer {
  private canvas: HTMLCanvasElement | null = null;
  private epoch = 0;
  private validation: Promise<boolean> | null = null;
  constructor(
    readonly strip: ScrubPreviewStrip,
    readonly video: HTMLVideoElement,
    private validate: () => Promise<boolean>,
  ) {}
  request(time: number): void {
    // The queue has only one in-flight draw. Let it paint before the latest
    // queued position so continuous in-range movement cannot starve images.
    if (!findScrubFrame(this.strip, time)) this.end();
  }
  end(): void {
    this.epoch++;
    this.validation = null;
    this.canvas?.remove();
    this.canvas = null;
  }
  async draw(time: number, signal: AbortSignal): Promise<number | null> {
    if (drawing) return null;
    drawing = true;
    const epoch = this.epoch;
    const decoded = this.decode(time, signal).finally(() => {
      drawing = false;
    });
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        decoded,
        new Promise<null>((resolve) => {
          timer = setTimeout(() => {
            if (epoch === this.epoch) this.end();
            resolve(null);
          }, 90);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }
  private async decode(
    time: number,
    signal: AbortSignal,
  ): Promise<number | null> {
    const { strip, video } = this;
    const frame = findScrubFrame(strip, time);
    if (!frame || video.currentSrc !== strip.sourceUrl || !video.isConnected) {
      this.end();
      return null;
    }
    const epoch = this.epoch;
    const live = (): boolean =>
      !signal.aborted &&
      epoch === this.epoch &&
      video.isConnected &&
      video.currentSrc === strip.sourceUrl;
    this.validation ??= this.validate().catch(() => false);
    if (!(await this.validation) || !live()) return null;
    const bytes = strip.bytes.slice(frame.offset, frame.offset + frame.size);
    const bitmap = await createImageBitmap(
      new Blob([bytes], { type: 'image/jpeg' }),
    );
    try {
      if (!live()) return null;
      let canvas = this.canvas;
      if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        canvas.setAttribute('aria-hidden', 'true');
        canvas.style.cssText =
          'position:absolute;inset:0;width:100%;height:100%;object-fit:contain;pointer-events:none';
        video.after(canvas);
        this.canvas = canvas;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        this.end();
        return null;
      }
      ctx.drawImage(bitmap, 0, 0);
      return frame.pts / scrubTicksPerSecond;
    } finally {
      bitmap.close();
    }
  }
}
