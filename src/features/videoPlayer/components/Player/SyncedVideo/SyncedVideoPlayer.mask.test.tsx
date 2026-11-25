// @vitest-environment jsdom
import { ThemeProvider } from '@mui/material/styles';
import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { getAppTheme } from '../../../../../design-system/theme';
import { SyncedVideoPlayer } from './SyncedVideoPlayer';

vi.mock('../../../../../shared/hooks/useVideoWindowAspect', () => ({
  useVideoWindowAspect: vi.fn(),
}));
vi.mock('./hooks/useSyncedVideoPlayer', () => ({
  useSyncedVideoPlayer: () => ({
    blockPlayStates: [],
    aspectRatios: [],
    handleAspectRatioChange: vi.fn(),
  }),
}));
vi.mock('../SingleVideoPlayer', () => ({
  MemoizedSingleVideoPlayer: ({ id }: { id: string }) => (
    <video data-testid={id} />
  ),
}));

it('covers only the pending cell without replacing its decoder when frames arrive', () => {
  const view = (mask: readonly number[], videoList = ['a', 'c']) => (
    <ThemeProvider theme={getAppTheme('dark')}>
      <SyncedVideoPlayer
        videoList={videoList}
        isVideoPlaying={false}
        videoPlayBackRate={1}
        setMaxSec={vi.fn()}
        maskedScrubAngles={mask}
      />
    </ThemeProvider>
  );
  const app = render(view([]));
  const first = screen.getByTestId('video_0');
  const second = screen.getByTestId('video_1');
  expect(screen.queryByRole('status')).toBeNull();
  app.rerender(view([1]));
  const mask = screen.getByRole('status', { name: 'アングル2の映像を同期中' });
  expect(mask.parentElement).toBe(second.parentElement);
  expect(mask.parentElement).not.toBe(first.parentElement);
  expect(getComputedStyle(mask).backgroundColor).toBe('rgb(0, 0, 0)');
  expect(getComputedStyle(mask).position).toBe('absolute');
  expect(screen.getByTestId('video_1')).toBe(second);
  app.rerender(view([]));
  expect(screen.queryByRole('status')).toBeNull();
  expect(screen.getByTestId('video_1')).toBe(second);
  app.rerender(view([], ['a']));
  expect(screen.queryByRole('status')).toBeNull();
  expect(screen.getByTestId('video_0')).toBe(first);
});
