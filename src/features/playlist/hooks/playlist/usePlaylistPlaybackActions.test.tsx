// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PlaylistItem } from '../../../../types/playlist/core';
import { usePlaylistPlaybackActions } from './usePlaylistPlaybackActions';

const item: PlaylistItem = {
  id: 'clip-1',
  timelineItemId: 'timeline-1',
  actionName: 'Goal',
  startTime: 10,
  endTime: 20,
  addedAt: 1,
};

const createParams = () => {
  const video = document.createElement('video');
  const video2 = document.createElement('video');
  vi.spyOn(video, 'play').mockResolvedValue(undefined);
  vi.spyOn(video, 'pause').mockImplementation(() => undefined);
  vi.spyOn(video2, 'play').mockResolvedValue(undefined);
  vi.spyOn(video2, 'pause').mockImplementation(() => undefined);
  return {
    items: [item],
    currentItem: item,
    currentIndex: 0,
    setCurrentIndex: vi.fn(),
    isPlaying: false,
    setIsPlaying: vi.fn(),
    isFrozen: false,
    setIsFrozen: vi.fn(),
    autoAdvance: true,
    loopPlaylist: false,
    currentVideoSource2: '/tmp/angle-2.mp4',
    videoRef: { current: video },
    videoRef2: { current: video2 },
    setVolume: vi.fn(),
    containerRef: { current: null },
    isFullscreen: false,
    setIsFullscreen: vi.fn(),
    minFreezeDuration: 0.2,
    lastFreezeTimestampRef: { current: null },
    freezeTimeoutRef: { current: null },
  };
};

describe('usePlaylistPlaybackActions', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('clamps seeks to the active clip range for both angles', () => {
    const params = createParams();
    const { result } = renderHook(() => usePlaylistPlaybackActions(params));

    act(() => result.current.handleSeek(new Event('seek'), 30));
    expect(params.videoRef.current.currentTime).toBe(20);
    expect(params.videoRef2.current.currentTime).toBe(20);

    act(() => result.current.handleSeek(new Event('seek'), 2));
    expect(params.videoRef.current.currentTime).toBe(10);
  });

  it('resumes automatically after the configured freeze duration', () => {
    vi.useFakeTimers();
    const params = createParams();
    const { result } = renderHook(() => usePlaylistPlaybackActions(params));

    act(() => result.current.triggerFreezeFrame(0.5));
    expect(params.setIsFrozen).toHaveBeenCalledWith(true);
    expect(params.setIsPlaying).toHaveBeenCalledWith(false);

    act(() => vi.advanceTimersByTime(500));
    expect(params.setIsFrozen).toHaveBeenLastCalledWith(false);
    expect(params.setIsPlaying).toHaveBeenLastCalledWith(true);
  });
});
