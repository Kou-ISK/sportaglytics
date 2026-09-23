import type { PackageMediaClip } from '../../../../types/package/media';
import { resolveTimelineClip } from '../../../../types/package/clipTimeline';
import { captureMp4MimeType } from './mp4Codec';

const KEEP_BEHIND = 20;
const KEEP_AHEAD = 10;

/** One decoder/source per angle. Only nearby saved fragments are read into memory. */
export class CaptureMediaBuffer {
  private buffer: SourceBuffer | undefined;
  private disposed = false;
  private running = false;
  private clips: PackageMediaClip[] = [];
  private time = 0;
  private loaded = new Map<string, { start: number; end: number }>();
  private abort = new AbortController();

  constructor(
    private readonly source: MediaSource,
    private readonly read: (
      path: string,
      signal: AbortSignal,
    ) => Promise<ArrayBuffer>,
    private readonly onError: () => void,
  ) {
    source.addEventListener('sourceopen', this.pump);
  }

  update(clips: PackageMediaClip[], time: number): void {
    this.clips = clips;
    this.time = Math.max(0, time);
    this.pump();
  }

  private operation(action: () => void): Promise<void> {
    const buffer = this.buffer;
    if (!buffer || this.disposed) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const cleanup = (): void => {
        buffer.removeEventListener('updateend', success);
        buffer.removeEventListener('error', failure);
        this.abort.signal.removeEventListener('abort', failure);
      };
      const success = (): void => {
        cleanup();
        resolve();
      };
      const failure = (): void => {
        cleanup();
        reject(new Error('Media buffer interrupted'));
      };
      buffer.addEventListener('updateend', success, { once: true });
      buffer.addEventListener('error', failure, { once: true });
      this.abort.signal.addEventListener('abort', failure, { once: true });
      try {
        action();
      } catch (error) {
        cleanup();
        reject(error);
      }
    });
  }

  private pump = (): void => {
    if (this.running || this.disposed || this.source.readyState !== 'open')
      return;
    this.running = true;
    void this.fill()
      .catch(() => {
        if (!this.disposed) {
          this.dispose();
          this.onError();
        }
      })
      .finally(() => {
        this.running = false;
      });
  };

  private async fill(): Promise<void> {
    const time = this.time;
    // A discontinuous seek releases old data before requesting another interval.
    if (this.buffer?.buffered.length) {
      const end = this.buffer.buffered.end(this.buffer.buffered.length - 1);
      const start = this.buffer.buffered.start(0);
      if (time < start - 1 || time > end + 1) {
        await this.operation(() => this.buffer?.remove(0, end + 1));
        this.loaded.clear();
      } else if (start < time - KEEP_BEHIND - 4) {
        const cutoff = Math.max(0, time - KEEP_BEHIND);
        await this.operation(() => this.buffer?.remove(0, cutoff));
        for (const [id, interval] of this.loaded)
          if (interval.start < cutoff) this.loaded.delete(id);
      }
    }
    if (this.buffer?.buffered.length) {
      const end = this.buffer.buffered.end(this.buffer.buffered.length - 1);
      if (end > time + KEEP_AHEAD + 4) {
        const cutoff = time + KEEP_AHEAD + 2;
        await this.operation(() => this.buffer?.remove(cutoff, end + 1));
        for (const [id, interval] of this.loaded)
          if (interval.end > cutoff) this.loaded.delete(id);
      }
    }
    const active = resolveTimelineClip(this.clips, time);
    const from = active?.clip.timelineStartSeconds ?? time;
    // Snapshot iteration is bounded by time, including a real gap after reconnect.
    const candidates = this.clips.filter(
      (clip) =>
        clip.timelineStartSeconds >= from &&
        clip.timelineStartSeconds <= time + KEEP_AHEAD,
    );
    for (const clip of candidates) {
      if (this.disposed || Math.abs(this.time - time) > KEEP_AHEAD) return;
      if (this.loaded.has(clip.id)) continue;
      const data = await this.read(clip.source, this.abort.signal);
      if (this.disposed) return;
      if (!this.buffer) {
        const mime = captureMp4MimeType(data);
        if (!MediaSource.isTypeSupported(mime))
          throw new Error('Unsupported capture codec');
        this.buffer = this.source.addSourceBuffer(mime);
      }
      const start = clip.timelineStartSeconds;
      const end = start + (clip.durationSeconds ?? 2);
      this.source.duration = Math.max(this.source.duration || 0, end + 1);
      this.buffer.timestampOffset = start;
      this.buffer.appendWindowStart = 0;
      // CSV boundaries describe video packets. Cropping AAC at those timestamps
      // drops a whole audio frame and creates a hole at every fragment boundary.
      // Preserve complete packets; MSE splices overlapping frames on the next append.
      this.buffer.appendWindowEnd = Infinity;
      await this.operation(() => this.buffer?.appendBuffer(data));
      this.loaded.set(clip.id, { start, end });
    }
  }

  dispose(): void {
    this.disposed = true;
    this.abort.abort();
    this.source.removeEventListener('sourceopen', this.pump);
    if (this.buffer?.updating && this.source.readyState === 'open')
      this.buffer.abort();
    this.loaded.clear();
  }
}
