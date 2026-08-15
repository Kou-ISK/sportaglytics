import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlaylistItem } from '../../../../types/playlist/core';
import { usePlaylistPlaybackEffects } from './usePlaylistPlaybackEffects';

const item: PlaylistItem = {
  id: 'clip-1',
  timelineItemId: 'timeline-1',
  actionName: 'Goal',
  startTime: 12,
  endTime: 18,
  addedAt: 1,
  videoSource: '/tmp/match.mp4',
};

describe('usePlaylistPlaybackEffects', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn(() => 1),
    );
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  it('does not reload or rewind the source when playback is toggled', () => {
    const video = document.createElement('video');
    const load = vi.spyOn(video, 'load').mockImplementation(() => undefined);
    const play = vi.spyOn(video, 'play').mockResolvedValue(undefined);
    vi.spyOn(video, 'pause').mockImplementation(() => undefined);
    const videoRef = { current: video };
    const videoRef2 = { current: null };
    const lastFreezeTimestampRef = { current: null };
    const setCurrentTime = vi.fn();
    const setIsFrozen = vi.fn();
    const setDuration = vi.fn();
    const triggerFreezeFrame = vi.fn();
    const handleItemEnd = vi.fn();

    const { rerender } = renderHook(
      ({ isPlaying }: { isPlaying: boolean }) =>
        usePlaylistPlaybackEffects({
          isFrozen: false,
          setIsFrozen,
          currentItem: item,
          currentAnnotation: undefined,
          minFreezeDuration: 0.2,
          defaultFreezeDuration: 2,
          annotationTimeTolerance: 0.05,
          freezeRetriggerGuard: 0.5,
          videoRef,
          videoRef2,
          setCurrentTime,
          setDuration,
          isPlaying,
          currentVideoSource: item.videoSource ?? null,
          currentVideoSource2: null,
          viewMode: 'angle1',
          volume: 1,
          isMuted: false,
          lastFreezeTimestampRef,
          triggerFreezeFrame,
          handleItemEnd,
        }),
      { initialProps: { isPlaying: false } },
    );

    expect(load).toHaveBeenCalledTimes(1);
    expect(setCurrentTime).toHaveBeenCalledWith(item.startTime);

    video.currentTime = 15;
    rerender({ isPlaying: true });

    expect(load).toHaveBeenCalledTimes(1);
    expect(video.currentTime).toBe(15);
    expect(play).toHaveBeenCalled();

    video.currentTime = item.endTime;
    video.dispatchEvent(new Event('timeupdate'));
    video.dispatchEvent(new Event('ended'));
    expect(handleItemEnd).toHaveBeenCalledTimes(1);
  });
});
// @vitest-environment jsdom
