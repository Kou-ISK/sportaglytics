// @vitest-environment jsdom
import { useState } from 'react';
import type { ReactElement } from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { afterEach, expect, it, vi } from 'vitest';
import type {
  TimelineWindowCommand,
  TimelineWindowClockPayload,
  TimelineWindowSyncPayload,
} from '../../../../types/ipc/timelineWindow';
import { getAppTheme } from '../../../../theme';
import { TimelinePlayhead } from '../../components/Timeline/VisualTimeline/TimelinePlayhead';
import { VideoControllerToolbar } from '../../components/Controls/VideoController/VideoControllerToolbar';
import { useVideoControllerController } from '../../components/Controls/VideoController/hooks/useVideoControllerController';
import { useTimelineWindowController } from './useTimelineWindowController';
import { createTimelineWindowSeek } from './timelineWindowSeek';

const ports = vi.hoisted(() => ({
  sync: (_payload: TimelineWindowSyncPayload): void => {},
  clock: (_payload: TimelineWindowClockPayload): void => {},
  send: vi.fn(),
  player: { currentTime: vi.fn(() => 40) },
}));
vi.mock('../gateways/timelineWindowGateway', () => ({
  subscribeTimelineWindowSync: (listener: typeof ports.sync) => {
    ports.sync = listener;
    return () => {};
  },
  subscribeTimelineWindowClock: (listener: typeof ports.clock) => {
    ports.clock = listener;
    return () => {};
  },
  sendTimelineWindowCommand: ports.send,
}));
vi.mock(
  '../../components/Controls/VideoController/hooks/useExistingVideoJsPlayer',
  () => ({
    useExistingVideoJsPlayer: () => () => ports.player,
  }),
);

const payload: TimelineWindowSyncPayload = {
  timeline: [],
  rows: [],
  maxSec: 300,
  currentTime: 40,
  isPlaying: false,
  playbackRate: 1,
  selectedIds: [],
  teamNames: [],
  videoSources: ['synthetic.mp4'],
  hotkeys: [],
  updatedAt: 1,
};
const Timeline = (): ReactElement | null => {
  const controller = useTimelineWindowController();
  if (!controller) return null;
  return (
    <TimelinePlayhead
      position={0}
      maxSec={300}
      currentTime={controller.currentTime}
      formatTime={String}
      onSeek={(time) => controller.handleCurrentTime(new Event('seek'), time)}
      onSeekRelative={controller.onSeekRelative}
      seekHandlers={{
        onPointerDown: () => {},
        onPointerMove: () => {},
        onPointerUp: () => {},
        onPointerCancel: () => {},
        onLostPointerCapture: () => {},
      }}
    />
  );
};
const mountTimeline = (): HTMLElement => {
  render(
    <ThemeProvider theme={getAppTheme()}>
      <Timeline />
    </ThemeProvider>,
  );
  act(() => ports.sync(payload));
  return screen.getByRole('slider');
};
const ownerSeeks = (): ReturnType<typeof vi.fn<(time: number) => void>> => {
  let nativeDemand = 40;
  const epoch = {};
  const onSeek = vi.fn((time: number) => {
    nativeDemand = time;
  });
  const seek = createTimelineWindowSeek(() => ({
    epoch,
    currentTime: 40,
    maxSec: 300,
    videoSources: ['synthetic.mp4'],
    nativeCommandTime: nativeDemand,
    onSeek,
  }));
  // Only transport is simulated. Relative input uses the production owner resolver.
  ports.send.mockImplementation((command: TimelineWindowCommand) => {
    if (command.type === 'seek' || command.type === 'seek-relative')
      seek(command);
  });
  return onSeek;
};
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it('accepts three delivered slider keys when no clock notification interleaves', () => {
  const seeks = ownerSeeks();
  const slider = mountTimeline();
  for (let n = 0; n < 3; n++)
    fireEvent.keyDown(slider, { key: 'ArrowRight', shiftKey: true });
  expect(seeks.mock.calls.map(([time]) => time)).toEqual([50, 60, 70]);
});

it('retains all three relative key increments when an earlier owner clock arrives between inputs', () => {
  const seeks = ownerSeeks();
  const slider = mountTimeline();
  fireEvent.keyDown(slider, { key: 'ArrowRight', shiftKey: true });
  fireEvent.keyDown(slider, { key: 'ArrowRight', shiftKey: true });
  // The owner can publish the first completed position after the second demand.
  act(() =>
    ports.clock({
      currentTime: 50,
      isPlaying: false,
      playbackRate: 1,
      updatedAt: 2,
    }),
  );
  fireEvent.keyDown(slider, { key: 'ArrowRight', shiftKey: true });
  expect(seeks.mock.calls.map(([time]) => time)).toEqual([50, 60, 70]);
});

it('accumulates delivered toolbar clicks on the package clock while the HTML clock is still seeking', () => {
  const seek = vi.fn();
  const Toolbar = (): ReactElement => {
    const [currentTime, setCurrentTime] = useState(40);
    const props = useVideoControllerController({
      currentTime,
      setCurrentTime,
      isVideoPlaying: false,
      setIsVideoPlaying: vi.fn(),
      setVideoPlayBackRate: vi.fn(),
      videoPlayBackRate: 1,
      maxSec: 300,
      videoList: ['synthetic.mp4'],
      useTimelineClock: true,
      handleCurrentTime: (_event, value) => {
        if (typeof value === 'number') {
          seek(value);
          setCurrentTime(value);
        }
      },
    });
    return <VideoControllerToolbar {...props} />;
  };
  render(
    <ThemeProvider theme={getAppTheme()}>
      <Toolbar />
    </ThemeProvider>,
  );
  const forward = screen.getByRole('button', { name: '30秒進む' });
  for (let n = 0; n < 3; n++) fireEvent.click(forward);
  expect(seek.mock.calls.map(([time]) => time)).toEqual([70, 100, 130]);
});
