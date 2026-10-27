import { PlaybackRangeBuffer } from './PlaybackRangeBuffer';
import type { PlaybackRangeReader } from './PlaybackRangeBuffer';
import { validateRangeIndex, planPlaybackRange } from './rangeBufferIndex';
import type { PlaybackRangeIndex } from './rangeBufferIndex';
import { bindRangePlaybackClock } from './rangePlaybackRegistry';
import type { RangePlaybackClockPort } from './rangePlaybackRegistry';

/** Browser adapter for a verified lease. The adoption owner supplies the index,
 * MIME and reader, binds its Session, and performs original-return/selected ACK.
 * This adapter never edits package metadata or calls play/currentTime. */
export class RangeMediaSourceTransport implements RangePlaybackClockPort {
  readonly url: string;
  private readonly source: MediaSource;
  private readonly unbind: () => void;
  private controller: PlaybackRangeBuffer | null = null;
  private pendingTime: number;
  private pendingSeek = true;
  private stopped = false;
  private opened = false;
  private readonly detachment: Promise<void>;
  private confirmDetached: () => void = () => {};
  private error: Error | null = null;
  private closePromise: Promise<void> | null = null;

  constructor(
    private readonly video: HTMLVideoElement,
    private readonly index: PlaybackRangeIndex,
    private readonly mime: string,
    private readonly reader: PlaybackRangeReader,
    initialTime: number,
    private readonly onFailure: (error: Error) => void,
  ) {
    this.index = validateRangeIndex(index);
    planPlaybackRange(this.index, initialTime, 0);
    this.detachment = new Promise((resolve) => {
      this.confirmDetached = resolve;
    });
    if (!MediaSource.isTypeSupported(mime))
      throw Error('RANGE_MIME_UNSUPPORTED');
    this.pendingTime = initialTime;
    this.source = new MediaSource();
    this.url = URL.createObjectURL(this.source);
    try {
      this.unbind = bindRangePlaybackClock(video, this.url, this);
    } catch (error) {
      URL.revokeObjectURL(this.url);
      throw error;
    }
    this.source.addEventListener('sourceopen', this.open);
    this.source.addEventListener('sourceclose', this.closed);
  }

  get failure(): Error | null {
    return this.error;
  }

  private fail = (value: unknown): void => {
    if (this.error || this.stopped) return;
    this.error =
      value instanceof Error ? value : Error('RANGE_TRANSPORT_FAILED');
    try {
      this.onFailure(this.error);
    } catch {
      // Failed state remains observable; observer errors never acknowledge cleanup.
    }
  };

  private open = (): void => {
    if (this.stopped || this.controller || this.error) return;
    this.opened = true;
    try {
      const buffer = this.source.addSourceBuffer(this.mime);
      // All fragment tracks already carry original absolute clocks. Never use
      // captured-clip timestampOffset or trim a boundary AAC packet here.
      buffer.timestampOffset = 0;
      buffer.appendWindowStart = 0;
      buffer.appendWindowEnd = Infinity;
      this.source.duration = this.index.presentationEnd;
      this.controller = new PlaybackRangeBuffer(
        this.index,
        buffer,
        this.reader,
        this.fail,
        () => this.video.currentTime,
      );
      if (this.pendingSeek) this.controller.seek(this.pendingTime);
      else this.controller.demand(this.pendingTime);
    } catch (error) {
      this.fail(error);
    }
  };

  private closed = (): void => {
    this.controller?.sourceClosed();
    this.confirmDetached();
    if (!this.stopped) this.fail(Error('RANGE_TRANSPORT_DETACHED'));
  };

  demand(time: number): void {
    if (this.stopped || this.error) return;
    this.pendingTime = time;
    this.controller?.demand(time);
  }

  seek(time: number): void {
    if (this.stopped || this.error) return;
    this.pendingTime = time;
    this.pendingSeek = true;
    this.controller?.seek(time);
  }

  isReady(time: number, video: HTMLVideoElement): boolean {
    return (
      !this.stopped &&
      !this.error &&
      video === this.video &&
      (video.currentSrc || video.src) === this.url &&
      (this.controller?.isReady(time, video) ?? false)
    );
  }

  /** Call after initiating original-return/source detach. Native/reader close
   * remains owned even if it never acknowledges. Rejection is never retried. */
  dispose(): Promise<void> {
    if (this.closePromise) return this.closePromise;
    this.stopped = true;
    this.source.removeEventListener('sourceopen', this.open);
    URL.revokeObjectURL(this.url);
    const attachmentStarted =
      this.opened ||
      this.source.readyState !== 'closed' ||
      this.video.src === this.url ||
      this.video.currentSrc === this.url;
    this.closePromise = (async () => {
      if (this.controller) await this.controller.dispose();
      else {
        if (attachmentStarted) await this.detachment;
        await this.reader.close();
      }
      this.source.removeEventListener('sourceclose', this.closed);
      this.unbind();
    })();
    return this.closePromise;
  }
}
