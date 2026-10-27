import {
  bindVideoFrameClock,
  releaseVideoFrameClock,
} from '../../../shared/media/videoFrameClock';
import type { MediaTimeline } from '../../../shared/media/mediaTimeline';
import { resolveMediaTime } from '../../../shared/media/mediaTimeline';
import { formatSource } from '../../../shared/media/videoSource';

/** A source clock is private to this adapter. Callers only seek package time. */
export class TimelineVideoAdapter {
  private source = '';
  private placement: { id: string; offset: number } | null = null;
  private positionRequired = true;
  private pendingPosition: number | null = null;
  constructor(
    readonly video: HTMLVideoElement,
    readonly timeline: MediaTimeline,
  ) {}

  invalidatePosition(): void {
    this.positionRequired = true;
  }

  hasMediaAt(time: number): boolean {
    return resolveMediaTime(this.timeline, time) !== null;
  }

  /** Observe the media clock before synchronizing followers; never seek the leader
   * back to the previous animation callback's timestamp. */
  observedTime(time: number): number | null {
    const active = resolveMediaTime(this.timeline, time);
    if (
      !active ||
      this.positionRequired ||
      this.source !== active.clip.source ||
      this.placement?.id !== active.clip.id ||
      this.placement.offset !== active.sourceTimeOffset ||
      this.video.readyState < 1 ||
      this.video.seeking ||
      !Number.isFinite(this.video.currentTime) ||
      (this.pendingPosition !== null && !this.positionReady())
    )
      return null;
    return Math.min(
      active.globalEnd,
      this.video.currentTime - active.sourceTimeOffset,
    );
  }

  private positionReady(): boolean {
    if (this.video.readyState < 2 || this.video.seeking) return false;
    if (this.pendingPosition !== null) {
      if (Math.abs(this.video.currentTime - this.pendingPosition) > 0.015)
        return false;
      this.pendingPosition = null;
    }
    return Number.isFinite(this.video.currentTime);
  }

  sync(time: number, playing: boolean, force = false): boolean {
    const active = resolveMediaTime(this.timeline, time);
    if (!active) {
      releaseVideoFrameClock(this.video);
      this.video.pause();
      this.video.style.visibility = 'hidden';
      this.placement = null;
      this.positionRequired = true;
      this.pendingPosition = null;
      if (this.source) {
        this.source = '';
        this.video.removeAttribute('src');
        this.video.load();
      }
      return true;
    }
    bindVideoFrameClock(
      this.video,
      formatSource(active.clip.source),
      active.sourceTimeOffset,
    );
    this.video.style.visibility = '';
    if (
      this.placement?.id !== active.clip.id ||
      this.placement.offset !== active.sourceTimeOffset
    ) {
      this.placement = { id: active.clip.id, offset: active.sourceTimeOffset };
      this.positionRequired = true;
    }
    if (this.source !== active.clip.source) {
      this.source = active.clip.source;
      this.video.pause();
      this.video.src = formatSource(this.source);
      this.video.load();
    }
    if (this.video.error)
      throw new Error(
        '映像を読み込めません。元映像や外付けドライブの接続を確認してください。',
      );
    if (this.video.readyState < 1) return false;
    const positionRequired = force || this.positionRequired;
    if (positionRequired) {
      this.pendingPosition = active.sourceTime;
      this.positionRequired = false;
    }
    if (
      (positionRequired || !this.video.seeking) &&
      Math.abs(this.video.currentTime - active.sourceTime) >
        (playing && !positionRequired ? 0.15 : 0.015)
    ) {
      this.pendingPosition = active.sourceTime;
      this.video.currentTime = active.sourceTime;
    }
    const ready = this.positionReady();
    if (playing && ready && this.video.ended)
      throw new Error(
        '映像が保存された区間より早く終了しました。元映像と区間を確認してください。',
      );
    if (playing && ready && this.video.paused)
      void this.video.play().catch(() => undefined);
    if (!playing) this.video.pause();
    return ready;
  }

  dispose(): void {
    releaseVideoFrameClock(this.video);
    this.video.pause();
    this.video.style.visibility = '';
  }
}
