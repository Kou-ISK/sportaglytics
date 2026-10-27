import type {
  CacheHardwareMode,
  CacheProbeRange,
  CacheProbeSegment,
} from './cacheHardwareCoverage';

// Main's TypeScript target has no DOM library. This is the narrow page-only
// contract; declarations disappear when the self-contained function is serialized.
type ProbeFrameCallback = (
  now: number,
  metadata: { mediaTime: number },
) => void;
interface ProbeVideo {
  duration: number;
  currentTime: number;
  paused: boolean;
  seeking: boolean;
  muted: boolean;
  playbackRate: number;
  src: string;
  pause: () => void;
  play: () => Promise<void>;
  requestVideoFrameCallback: (callback: ProbeFrameCallback) => number;
  cancelVideoFrameCallback: (id: number) => void;
  onerror: (() => void) | null;
  onended: (() => void) | null;
  onseeked: (() => void) | null;
  onloadedmetadata: (() => void) | null;
}
declare const document: {
  querySelector: (selector: 'video') => ProbeVideo | null;
};
declare const window: object;

/** Serialized into the nonce-protected isolated page. No imports/global helpers
 * may be used at runtime. This page never controls the product player/clock. */
export const runCacheHardwareProbe = (
  media: string,
  mode: CacheHardwareMode,
  plan: (duration: number) => CacheProbeRange[],
): void => {
  const video = document.querySelector('video');
  if (!video) throw Error('CACHE_HARDWARE_VIDEO');
  const state = {
    completed: false,
    ended: false,
    failed: false,
    frames: 0,
    maximumTime: 0,
    duration: 0,
    segments: [] as CacheProbeSegment[],
  };
  Object.assign(window, { __cacheProbe: state });
  let ranges: CacheProbeRange[] = [];
  let index = 0;
  let generation = 0;
  let callback = 0;
  let active = false;
  let current: CacheProbeSegment | undefined;
  const stop = (): void => {
    active = false;
    generation++;
    video.cancelVideoFrameCallback(callback);
    video.pause();
  };
  const fail = (): void => {
    state.failed = true;
    stop();
  };
  const finishRange = (ended: boolean): void => {
    if (!active || !current) return;
    stop();
    current.ended = ended;
    state.segments.push(current);
    if (++index === ranges.length) {
      if (!ended) {
        fail();
        return;
      }
      state.completed = true;
      return;
    }
    if (ended) {
      fail();
      return;
    }
    // The next callbacks are registered only after this seek finishes.
    video.currentTime = ranges[index].start;
  };
  const begin = (): void => {
    if (state.failed || state.completed || active || video.seeking) return;
    if (mode === 'compatibility') {
      const range = ranges[index];
      // An unrelated/late seeked event cannot begin a different range.
      if (
        !range ||
        (index > 0 && Math.abs(video.currentTime - range.start) > 0.002)
      ) {
        fail();
        return;
      }
      current = {
        ...range,
        firstClock: -1,
        lastClock: -1,
        first: -1,
        last: -1,
        frames: 0,
        ended: false,
      };
    }
    active = true;
    const token = ++generation;
    const frame: ProbeFrameCallback = (_now, metadata) => {
      if (token !== generation || !active || state.failed) return;
      if (!video.seeking && !video.paused) {
        const time = metadata.mediaTime;
        if (!Number.isFinite(time)) {
          fail();
          return;
        }
        state.frames++;
        state.maximumTime = Math.max(state.maximumTime, time);
        if (current) {
          // A seek jump or stale pre-seek picture is not playback progress.
          if (time < 0 || (current.frames > 0 && time < current.last)) {
            fail();
            return;
          }
          if (current.frames === 0) {
            current.first = time;
            current.firstClock = video.currentTime;
          }
          current.lastClock = video.currentTime;
          if (time > current.last) current.frames++;
          current.last = time;
          if (index < ranges.length - 1 && video.currentTime >= current.end) {
            finishRange(false);
            return;
          }
        }
      }
      callback = video.requestVideoFrameCallback(frame);
    };
    callback = video.requestVideoFrameCallback(frame);
    void video.play().catch(fail);
  };
  video.onerror = fail;
  video.onended = (): void => {
    if (mode === 'full') {
      if (!active || state.failed) return;
      stop();
      state.ended = true;
      state.completed = true;
    } else finishRange(true);
  };
  video.onseeked = (): void => {
    if (mode === 'compatibility') begin();
  };
  video.onloadedmetadata = (): void => {
    try {
      state.duration = video.duration;
      if (mode === 'compatibility') ranges = plan(video.duration);
      begin();
    } catch {
      fail();
    }
  };
  video.muted = true;
  video.playbackRate = 1;
  video.src = media;
};
