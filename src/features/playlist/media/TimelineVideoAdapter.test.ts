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
  it('observes the real package time with its bound offset and rejects old placements', () => {
    const video = createVideo();
    const player = new TimelineVideoAdapter(video, timeline);
    player.sync(2, true);
    video.currentTime = 3.3;
    expect(player.observedTime(2)).toBeCloseTo(2.3);
    expect(player.observedTime(9)).toBeNull();
    player.invalidatePosition();
    expect(player.observedTime(2)).toBeNull();
    player.sync(3, false, true);
    expect(player.observedTime(3)).toBe(3);
  });

  it('distinguishes true gaps from a decoder waiting for the current source', () => {
    const video = createVideo();
    const player = new TimelineVideoAdapter(video, timeline);
    expect(player.hasMediaAt(2)).toBe(true);
    expect(player.observedTime(2)).toBeNull();
    expect(player.hasMediaAt(5.5)).toBe(false);
    player.sync(2, true);
    Object.defineProperty(video, 'readyState', {
      configurable: true,
      value: 1,
    });
    expect(player.hasMediaAt(2)).toBe(true);
    expect(player.observedTime(2)).toBe(2);
    expect(player.sync(2, true)).toBe(false);
  });

  it('does not reuse an identical source URL at a different timeline placement', () => {
    const video = createVideo();
    const repeated: MediaTimeline = {
      offsetSeconds: 0,
      clips: [
        {
          id: 'first',
          source: '/media/C.mp4',
          timelineStartSeconds: 0,
          durationSeconds: 6,
        },
        {
          id: 'second',
          source: '/media/C.mp4',
          timelineStartSeconds: 6,
          durationSeconds: 6,
        },
      ],
    };
    const player = new TimelineVideoAdapter(video, repeated);
    player.sync(5, true);
    expect(player.observedTime(6)).toBeNull();
    player.sync(6, true);
    expect(video.currentTime).toBe(0);
    expect(player.observedTime(6)).toBe(6);
    expect(video.load).toHaveBeenCalledOnce();
  });
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
