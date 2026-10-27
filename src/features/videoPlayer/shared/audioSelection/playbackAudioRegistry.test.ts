/* @vitest-environment jsdom */
import { afterEach, expect, it, vi } from 'vitest';
import {
  getPlaybackAudioRegistrations,
  registerPlaybackAudio,
  subscribePlaybackAudio,
} from './playbackAudioRegistry';
const cleanup: Array<() => void> = [];
afterEach(() => {
  cleanup.splice(0).forEach((dispose) => dispose());
  expect(getPlaybackAudioRegistrations()).toEqual([]);
});
const fixture = () => {
  const video = document.createElement('video');
  const tracks = Object.assign(new EventTarget(), {
    length: 3,
    0: { enabled: true },
    1: { enabled: false },
    2: { enabled: false },
  });
  Object.defineProperties(video, {
    currentSrc: { value: 'file:///a.mp4', configurable: true },
    readyState: { value: 4, configurable: true },
    audioTracks: { value: tracks, configurable: true },
  });
  const changed = vi.fn();
  cleanup.push(subscribePlaybackAudio(changed));
  const release = registerPlaybackAudio('video_0', 'file:///a.mp4', video);
  cleanup.push(release);
  return {
    video,
    tracks,
    changed,
    release,
    read: () => getPlaybackAudioRegistrations()[0]?.read(),
  };
};
it('reads actual exclusive native tracks and reacts to change without polling', () => {
  const { tracks, changed, read } = fixture();
  expect(read()).toBe(0);
  changed.mockClear();
  tracks[0].enabled = false;
  tracks[2].enabled = true;
  tracks.dispatchEvent(new Event('change'));
  expect(changed).toHaveBeenCalledOnce();
  expect(read()).toBe(2);
  tracks[0].enabled = true;
  expect(read()).toBeNull();
  tracks[0].enabled = false;
  tracks[2].enabled = false;
  expect(read()).toBeNull();
});
it('invalidates changed sources and detaches listeners on replacement and disposal', () => {
  const { video, tracks, changed, release, read } = fixture();
  Object.defineProperty(video, 'currentSrc', { value: 'file:///b.mp4' });
  video.dispatchEvent(new Event('emptied'));
  expect(read()).toBeUndefined();
  const replacement = Object.assign(new EventTarget(), {
    length: 1,
    0: { enabled: true },
  });
  Object.defineProperty(video, 'audioTracks', { value: replacement });
  video.dispatchEvent(new Event('loadedmetadata'));
  changed.mockClear();
  tracks.dispatchEvent(new Event('change'));
  expect(changed).not.toHaveBeenCalled();
  replacement.dispatchEvent(new Event('addtrack'));
  expect(changed).toHaveBeenCalledOnce();
  release();
  changed.mockClear();
  replacement.dispatchEvent(new Event('change'));
  video.dispatchEvent(new Event('loadedmetadata'));
  expect(changed).not.toHaveBeenCalled();
});
