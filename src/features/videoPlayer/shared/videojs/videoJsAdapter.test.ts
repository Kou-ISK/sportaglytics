import { beforeEach, describe, expect, it, vi } from 'vitest';

const videoJsMocks = vi.hoisted(() => ({
  getPlayer: vi.fn(),
}));

vi.mock('video.js', () => ({
  default: {
    getPlayer: videoJsMocks.getPlayer,
  },
}));

import {
  getVideoJsPlayer,
  getVideoJsPlayerCurrentTime,
  isYoutubeVideoJsPlayer,
  setVideoJsPlayerCurrentTime,
} from './videoJsAdapter';

describe('videoJsAdapter', () => {
  it('recognizes the YouTube tech used by shared playback controls', () => {
    expect(isYoutubeVideoJsPlayer({ currentType: () => 'video/youtube' })).toBe(
      true,
    );
    expect(isYoutubeVideoJsPlayer({ currentType: () => 'video/mp4' })).toBe(
      false,
    );
    expect(isYoutubeVideoJsPlayer({ techName_: 'Youtube' })).toBe(true);
  });

  beforeEach(() => {
    videoJsMocks.getPlayer.mockReset();
  });

  it('returns existing players and reads their current time', () => {
    const player = {
      isDisposed: () => false,
      currentTime: () => 12.5,
    };
    videoJsMocks.getPlayer.mockReturnValue(player);

    expect(getVideoJsPlayer('video_0')).toBe(player);
    expect(getVideoJsPlayerCurrentTime('video_0')).toBe(12.5);
  });

  it('rejects disposed players and safely sets current time', () => {
    const currentTime = vi.fn();
    const player = {
      isDisposed: () => false,
      currentTime,
    };
    videoJsMocks.getPlayer.mockReturnValueOnce({
      isDisposed: () => true,
      currentTime: vi.fn(),
    });
    videoJsMocks.getPlayer.mockReturnValue(player);

    expect(getVideoJsPlayer('video_0')).toBeUndefined();
    expect(setVideoJsPlayerCurrentTime('video_0', 3.25)).toBe(true);
    expect(currentTime).toHaveBeenCalledWith(3.25);
  });
});
