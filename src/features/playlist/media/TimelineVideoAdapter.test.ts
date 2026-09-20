// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TimelineVideoAdapter } from './TimelineVideoAdapter';
import type { MediaTimeline } from '../../../shared/media/mediaTimeline';
const timeline: MediaTimeline = {
  offsetSeconds: 2,
  clips: [
    {
      id: 'C',
      source: '/media/C.mp4',
      timelineStartSeconds: 1,
      durationSeconds: 6,
    },
    {
      id: 'D',
      source: '/media/D.mp4',
      timelineStartSeconds: 8,
      durationSeconds: 6,
    },
  ],
};
beforeEach(() => vi.restoreAllMocks());
const createVideo = () => {
  const video = document.createElement('video');
  Object.defineProperty(video, 'readyState', { configurable: true, value: 4 });
  vi.spyOn(video, 'load').mockImplementation(() => undefined);
  vi.spyOn(video, 'pause').mockImplementation(() => undefined);
  vi.spyOn(video, 'play').mockResolvedValue(undefined);
  return video;
};
describe('Playlist package video adapter', () => {
  it('seeks a later clip in local seconds and hides the actual gap', () => {
    const video = createVideo();
    const player = new TimelineVideoAdapter(video, timeline);
    player.sync(2, false, true);
    expect(video.src).toBe('file:///media/C.mp4');
    expect(video.currentTime).toBe(3);
    player.sync(5.5, false);
    expect(video.hasAttribute('src')).toBe(false);
    expect(video.style.visibility).toBe('hidden');
    player.sync(9, false, true);
    expect(video.src).toBe('file:///media/D.mp4');
    expect(video.currentTime).toBe(3);
    expect(video.style.visibility).toBe('');
  });
  it('waits for metadata after a source switch and does not reload on pause/resume', () => {
    const video = createVideo();
    Object.defineProperty(video, 'readyState', {
      configurable: true,
      value: 0,
    });
    const player = new TimelineVideoAdapter(video, timeline);
    expect(player.sync(9, true)).toBe(false);
    expect(video.play).not.toHaveBeenCalled();
    Object.defineProperty(video, 'readyState', {
      configurable: true,
      value: 4,
    });
    expect(player.sync(9, true)).toBe(true);
    expect(video.currentTime).toBe(3);
    player.sync(9, false);
    player.sync(9, true);
    expect(video.load).toHaveBeenCalledOnce();
  });
});
