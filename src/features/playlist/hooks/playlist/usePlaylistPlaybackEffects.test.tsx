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
          currentAnnotation: {
            freezeDuration: 2,
            freezeAt: 0,
            objects: [
              {
                id: 'annotation',
                type: 'arrow',
                color: '#ffffff',
                strokeWidth: 2,
                startX: 0,
                startY: 0,
                endX: 10,
                endY: 10,
                timestamp: 15,
              },
            ],
          },
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
    video.dispatchEvent(new Event('timeupdate'));
    expect(triggerFreezeFrame).not.toHaveBeenCalled();
    expect(handleItemEnd).not.toHaveBeenCalled();
    rerender({ isPlaying: true });
    video.dispatchEvent(new Event('timeupdate'));
    expect(triggerFreezeFrame).toHaveBeenCalledWith(2);

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

it('uses angle 2 for clock, end and audio, and preserves time across preview switches', () => {
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn(() => 1),
  );
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  const videos = [
    document.createElement('video'),
    document.createElement('video'),
  ];
  for (const video of videos) {
    vi.spyOn(video, 'load').mockImplementation(() => undefined);
    vi.spyOn(video, 'play').mockResolvedValue(undefined);
    vi.spyOn(video, 'pause').mockImplementation(() => undefined);
  }
  const options = {
    isFrozen: false,
    setIsFrozen: vi.fn(),
    currentItem: item,
    minFreezeDuration: 0.2,
    defaultFreezeDuration: 2,
    annotationTimeTolerance: 0.05,
    freezeRetriggerGuard: 0.5,
    videoRef: { current: videos[0] },
    videoRef2: { current: videos[1] },
    setCurrentTime: vi.fn(),
    setDuration: vi.fn(),
    isPlaying: true,
    currentVideoSource: 'one.mp4',
    currentVideoSource2: 'two.mp4',
    volume: 0.7,
    isMuted: false,
    lastFreezeTimestampRef: { current: null },
    triggerFreezeFrame: vi.fn(),
    handleItemEnd: vi.fn(),
  };
  const { rerender } = renderHook(
    ({ viewMode }: { viewMode: 'angle1' | 'angle2' }) =>
      usePlaylistPlaybackEffects({ ...options, viewMode }),
    { initialProps: { viewMode: 'angle2' } },
  );
  expect(videos[1].volume).toBe(0.7);
  expect(videos[0].volume).toBe(0);
  videos[1].currentTime = 16;
  videos[1].dispatchEvent(new Event('timeupdate'));
  expect(options.setCurrentTime).toHaveBeenLastCalledWith(16);
  rerender({ viewMode: 'angle1' });
  expect(videos[0].currentTime).toBe(16);
  expect(videos[0].volume).toBe(0.7);
  rerender({ viewMode: 'angle2' });
  videos[1].currentTime = 18;
  videos[1].dispatchEvent(new Event('timeupdate'));
  expect(options.handleItemEnd).toHaveBeenCalledOnce();
});
