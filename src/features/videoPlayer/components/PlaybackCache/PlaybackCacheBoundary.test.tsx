/* @vitest-environment jsdom */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { PlaybackCacheBoundary } from './PlaybackCacheBoundary';

const hooks = vi.hoisted(() => ({ cache: vi.fn(), register: vi.fn() }));
vi.mock('./usePlaybackCacheController', () => ({
  usePlaybackCacheController: hooks.cache,
}));
vi.mock('../NativePlayback/useNativePlaybackPanel', () => ({
  useNativePlaybackPanel: () => ({ register: hooks.register, view: null }),
}));
afterEach(cleanup);
it('opens original playback without starting copy preparation or showing a copy control', () => {
  render(
    <PlaybackCacheBoundary
      eligible
      playing={false}
      timelineTime={0}
      pause={vi.fn()}
      onNativeRestored={vi.fn()}
    >
      <div>映像</div>
    </PlaybackCacheBoundary>,
  );
  expect(screen.getByText('映像')).toBeTruthy();
  expect(screen.queryByRole('button', { name: '再生用コピー' })).toBeNull();
  expect(hooks.cache).not.toHaveBeenCalled();
});
