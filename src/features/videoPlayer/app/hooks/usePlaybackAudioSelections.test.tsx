/* @vitest-environment jsdom */
import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { registerPlaybackAudio } from '../../shared/audioSelection/playbackAudioRegistry';
import { usePlaybackAudioSelections } from './usePlaybackAudioSelections';
const native = vi.hoisted(() => ({
  source: null as string | null,
  phase: 'original',
  observation: null as null | {
    audioReady: boolean;
    videoReady: boolean;
    phase: string;
    audioTrack: number;
  },
}));
vi.mock('../../shared/nativePlayback/useNativePlaybackState', () => ({
  useNativePlaybackState: () => ({
    controller: native.source ? { sourceUrl: native.source } : null,
    state: { phase: native.phase, observation: native.observation },
  }),
}));
const cleanup: Array<() => void> = [];
afterEach(() => {
  cleanup.splice(0).forEach((close) => close());
  native.source = null;
  native.phase = 'original';
  native.observation = null;
});
const register = (id: string, source: string) => {
  const video = document.createElement('video');
  const tracks = Object.assign(new EventTarget(), {
    length: 3,
    0: { enabled: true },
    1: { enabled: false },
    2: { enabled: false },
  });
  Object.defineProperties(video, {
    currentSrc: { value: source },
    readyState: { value: 4 },
    audioTracks: { value: tracks },
  });
  cleanup.push(registerPlaybackAudio(id, source, video));
  return tracks;
};
it('keeps source-bound selections stable across unchanged native clock notifications', () => {
  register('video_0', 'file:///a.mp4');
  register('video_1', 'file:///b.mp4');
  native.source = 'file:///a.mp4';
  native.phase = 'active';
  native.observation = {
    audioReady: true,
    videoReady: true,
    phase: 'playing',
    audioTrack: 2,
  };
  const { result, rerender, unmount } = renderHook(() =>
    usePlaybackAudioSelections(['/a.mp4', '/b.mp4']),
  );
  expect(result.current).toEqual([
    { source: '/a.mp4', audioTrackIndex: 2 },
    { source: '/b.mp4', audioTrackIndex: 0 },
  ]);
  const before = result.current;
  rerender();
  expect(result.current).toBe(before);
  native.observation = { ...native.observation, audioReady: false };
  rerender();
  expect(result.current[0].audioTrackIndex).toBeNull();
  native.observation = {
    audioReady: true,
    videoReady: true,
    phase: 'seeking',
    audioTrack: 1,
  };
  rerender();
  expect(result.current[0].audioTrackIndex).toBeNull();
  unmount();
});
it('blocks transitional native audio and re-reads confirmed HTML settings on restoration', () => {
  const tracks = register('video_0', 'file:///a.mp4');
  native.source = 'file:///a.mp4';
  native.phase = 'closing';
  const { result, rerender, unmount } = renderHook(() =>
    usePlaybackAudioSelections(['/a.mp4']),
  );
  expect(result.current[0].audioTrackIndex).toBeNull();
  tracks[0].enabled = false;
  tracks[2].enabled = true;
  native.phase = 'original';
  rerender();
  expect(result.current[0].audioTrackIndex).toBe(2);
  act(() => {
    tracks[2].enabled = false;
    tracks[1].enabled = true;
    tracks.dispatchEvent(new Event('change'));
  });
  expect(result.current[0].audioTrackIndex).toBe(1);
  unmount();
});
it('never carries a previous source or a preview registration into a new document', () => {
  register('video_0', 'file:///old.mp4');
  register('preview', 'file:///new.mp4');
  const { result, unmount } = renderHook(() =>
    usePlaybackAudioSelections(['/new.mp4']),
  );
  expect(result.current).toEqual([]);
  unmount();
});

it('deduplicates a source used by multiple angles and blocks conflicting or missing confirmations', () => {
  const first = register('video_0', 'file:///same.mp4');
  const second = register('video_1', 'file:///same.mp4');
  const { result, rerender, unmount } = renderHook(() =>
    usePlaybackAudioSelections(['/same.mp4', '/same.mp4']),
  );
  expect(result.current).toEqual([{ source: '/same.mp4', audioTrackIndex: 0 }]);
  act(() => {
    second[0].enabled = false;
    second[2].enabled = true;
    second.dispatchEvent(new Event('change'));
  });
  expect(result.current).toEqual([
    { source: '/same.mp4', audioTrackIndex: null },
  ]);
  first[0].enabled = false;
  first[2].enabled = true;
  rerender();
  expect(result.current).toEqual([{ source: '/same.mp4', audioTrackIndex: 2 }]);
  unmount();
});
