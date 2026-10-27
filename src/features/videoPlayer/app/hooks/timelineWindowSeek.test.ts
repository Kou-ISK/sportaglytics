import { expect, it, vi } from 'vitest';
import { createTimelineWindowSeek } from './timelineWindowSeek';
import type { VideoSeekMode } from '../../../../types/video/seek';

const make = () => {
  const state = {
    epoch: {},
    currentTime: 40,
    maxSec: 100,
    videoSources: ['synthetic.mp4'],
    nativeCommandTime: undefined as number | undefined,
    onSeek: vi.fn<(time: number, mode?: VideoSeekMode) => void>(),
  };
  const seek = createTimelineWindowSeek(() => ({ ...state }));
  const times = (): number[] => state.onSeek.mock.calls.map(([time]) => time);
  return { state, seek, times };
};

it('preserves preview versus exact across the separate timeline window', () => {
  const f = make();
  f.seek({ type: 'seek', time: 70, seekMode: 'preview' });
  f.seek({ type: 'seek', time: 70, seekMode: 'exact' });
  expect(f.state.onSeek.mock.calls).toEqual([
    [70, 'preview'],
    [70, 'exact'],
  ]);
});

it('accumulates commands before the owner commits and follows its clock after commit', () => {
  const f = make();
  f.seek({ type: 'seek-relative', seconds: 10 });
  f.seek({ type: 'seek-relative', seconds: 10 });
  f.seek({ type: 'seek-relative', seconds: -30 });
  expect(f.times()).toEqual([50, 60, 30]);
  expect(f.state.currentTime).toBe(40);
  f.state.currentTime = 31;
  f.seek({ type: 'seek-relative', seconds: 1 });
  expect(f.times()).toEqual([50, 60, 30, 32]);
});

it('uses native pending demand without changing confirmed playback time', () => {
  const f = make();
  f.state.nativeCommandTime = 60;
  f.seek({ type: 'seek-relative', seconds: 10 });
  f.state.nativeCommandTime = 70;
  f.state.currentTime = 50; // Earlier completed position.
  f.seek({ type: 'seek-relative', seconds: -30 });
  expect(f.times()).toEqual([70, 40]);
  expect(f.state.currentTime).toBe(50);
});

it('uses an intervening absolute seek and clamps each relative step at both ends', () => {
  const f = make();
  f.seek({ type: 'seek', time: 95 });
  f.seek({ type: 'seek-relative', seconds: 30 });
  f.seek({ type: 'seek-relative', seconds: -10 });
  f.seek({ type: 'seek', time: 2 });
  f.seek({ type: 'seek-relative', seconds: -10 });
  f.seek({ type: 'seek-relative', seconds: 1 });
  expect(f.times()).toEqual([95, 100, 90, 2, 0, 1]);
});

it('does not reuse another source request', () => {
  const f = make();
  f.seek({ type: 'seek-relative', seconds: 10 });
  f.state.videoSources = ['other.mp4'];
  f.seek({ type: 'seek-relative', seconds: 10 });
  expect(f.times()).toEqual([50, 50]);
});

it('invalidates a pending request across owner clock ABA commits', () => {
  const f = make();
  f.seek({ type: 'seek-relative', seconds: 10 });
  // Owner committed 50, then an absolute operation elsewhere returned to 40.
  // The final numeric clock matches; the committed epoch must not match.
  f.state.epoch = {};
  f.seek({ type: 'seek-relative', seconds: 10 });
  expect(f.times()).toEqual([50, 50]);
});
