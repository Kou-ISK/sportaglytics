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
  constructor(
    readonly video: HTMLVideoElement,
    readonly timeline: MediaTimeline,
  ) {}

  sync(time: number, playing: boolean, force = false): boolean {
    const active = resolveMediaTime(this.timeline, time);
    if (!active) {
      releaseVideoFrameClock(this.video);
      this.video.pause();
      this.video.style.visibility = 'hidden';
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
    if (
      (force || !this.video.seeking) &&
      Math.abs(this.video.currentTime - active.sourceTime) >
        (playing ? 0.15 : 0.015)
    ) {
      this.video.currentTime = active.sourceTime;
    }
    const ready = this.video.readyState >= 2 && !this.video.seeking;
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
