/* @vitest-environment jsdom */
import { afterEach, expect, it, vi } from 'vitest';
import { runCacheHardwareProbe } from './cacheHardwareProbePage';
import {
  planCacheCompatibility,
  readCacheHardwareCoverage,
} from './cacheHardwareCoverage';
const fixture = (duration = 60.074667) => {
  document.body.innerHTML = '<video></video>';
  const video = document.querySelector('video')!;
  let time = 0,
    paused = true,
    seeking = false,
    sequence = 0;
  const callbacks = new Map<number, VideoFrameRequestCallback>();
  Object.defineProperties(video, {
    duration: { get: () => duration },
    paused: { get: () => paused },
    seeking: { get: () => seeking },
    currentTime: {
      get: () => time,
      set: (value: number) => {
        time = value;
        seeking = true;
      },
    },
  });
  video.requestVideoFrameCallback = (fn) => {
    callbacks.set(++sequence, fn);
    return sequence;
  };
  video.cancelVideoFrameCallback = (id) => {
    callbacks.delete(id);
  };
  video.pause = () => {
    paused = true;
  };
  video.play = async () => {
    paused = false;
  };
  const state = (): unknown => Reflect.get(window, '__cacheProbe');
  const seeked = () => {
    seeking = false;
    video.dispatchEvent(new Event('seeked'));
  };
  const frame = (mediaTime: number) => {
    time = mediaTime;
    const work = [...callbacks.values()];
    callbacks.clear();
    work.forEach((fn) =>
      fn(0, {
        mediaTime,
        presentedFrames: sequence,
        presentationTime: 0,
        expectedDisplayTime: 0,
        width: 1920,
        height: 1080,
      }),
    );
  };
  runCacheHardwareProbe(
    'file:///candidate.mp4',
    'compatibility',
    planCacheCompatibility,
  );
  video.dispatchEvent(new Event('loadedmetadata'));
  return { video, frame, seeked, state, callbacks };
};
afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});
it('requires real playback in all three generations and reports compatibility without full ended', () => {
  const f = fixture();
  for (const [i, r] of planCacheCompatibility(60.074667).entries()) {
    if (i > 0) f.seeked();
    f.frame(r.start + 0.06);
    f.frame(r.end - 0.05);
    if (i < 2) f.frame(r.end + 0.001);
    else f.video.dispatchEvent(new Event('ended'));
  }
  const proof = readCacheHardwareCoverage(
    f.state(),
    'compatibility',
    f.video.duration + 0.04,
  );
  expect(proof.coverage.mode).toBe('compatibility');
  expect(f.state()).toMatchObject({
    completed: true,
    ended: false,
    failed: false,
  });
});
it('does not count seek jumps, paused frames or callbacks from previous generations', () => {
  const f = fixture();
  const old = [...f.callbacks.values()][0];
  f.frame(0.06);
  f.frame(2.001);
  // A canceled callback delivered after starting a seek cannot count.
  old(0, {
    mediaTime: 30,
    presentedFrames: 10,
    presentationTime: 0,
    expectedDisplayTime: 0,
    width: 1,
    height: 1,
  });
  expect(f.state()).toMatchObject({ frames: 2, completed: false });
  f.seeked();
  f.video.pause();
  f.frame(30);
  expect(f.state()).toMatchObject({ frames: 2, completed: false });
  f.video.dispatchEvent(new Event('ended'));
  expect(f.state()).toMatchObject({ failed: true, completed: false });
});
it('rejects wrong seek completion and early ended instead of skipping to final range', () => {
  const f = fixture();
  f.frame(0.06);
  f.frame(2.001);
  f.video.currentTime = 50;
  f.seeked();
  expect(f.state()).toMatchObject({ failed: true, completed: false });
});
it('keeps an earlier error fatal even if ended or seeked arrives later', () => {
  const f = fixture();
  f.video.dispatchEvent(new Event('error'));
  f.seeked();
  f.video.dispatchEvent(new Event('ended'));
  expect(f.state()).toMatchObject({ failed: true, completed: false });
});
it('covers a short nonzero-PTS video without seeks', () => {
  const f = fixture(1);
  f.frame(0.06);
  f.frame(0.98);
  f.video.dispatchEvent(new Event('ended'));
  expect(
    readCacheHardwareCoverage(
      f.state(),
      'compatibility',
      f.video.duration + 0.04,
    ).coverage.mode,
  ).toBe('compatibility');
});
