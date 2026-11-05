// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { NativePlaybackController } from '../../shared/nativePlayback/nativePlaybackController';
import type {
  NativePlaybackIntent,
  NativePlaybackSnapshot,
} from '../../../../types/ipc/nativePlayback';
import { useVideoReversePlayback } from './useVideoReversePlayback';
import type { NativePlaybackPresentation } from '../../../../types/ipc/nativePlaybackPresentation';

const port = vi.hoisted(() => ({
  controller: null as NativePlaybackController | null,
}));
vi.mock('../../shared/nativePlayback/nativePlaybackRegistry', () => ({
  getNativePlayback: () => port.controller,
  subscribeNativePlayback: () => () => {},
}));
let frames: Map<number, FrameRequestCallback>;
let nextId: number;
beforeEach(() => {
  vi.useFakeTimers();
  frames = new Map();
  nextId = 0;
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.set(++nextId, callback);
    return nextId;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
});
afterEach(() => {
  cleanup();
  port.controller = null;
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
const tick = async (time: number): Promise<void> => {
  await act(async () => {
    const pending = [...frames.values()];
    frames.clear();
    for (const callback of pending) callback(time);
    await vi.advanceTimersByTimeAsync(1);
  });
};
const setup = async (
  start = 10,
  restore = vi.fn(async () => {}),
  presentation: NativePlaybackPresentation | null = null,
  supportsReverse = false,
) => {
  const owner = { generation: 'reverse', sourceKey: 'a'.repeat(64) };
  let listener: (value: NativePlaybackSnapshot | null) => void = () => {};
  let revision = 0;
  let snapshot: NativePlaybackSnapshot = {
    intent: null,
    observation: null,
    lastConfirmedTime: start,
    error: null,
    closing: false,
    closed: false,
  };
  const apply = vi.fn(async (_value: NativePlaybackIntent) => {});
  const controller = new NativePlaybackController(
    {
      inspect: vi.fn(),
      open: vi.fn(async () => {}),
      apply,
      onSnapshot: (_owner, callback) => {
        listener = callback;
        return () => {};
      },
      observe: async () => snapshot,
      close: async () => ({
        generation: owner.generation,
        nativeDrained: true,
        processStarted: true,
        processExited: true,
        pipesClosed: true,
        stopped: snapshot.observation
          ? {
              ...owner,
              sequence: snapshot.observation.sequence,
              seekId: snapshot.observation.seekId,
              time: snapshot.lastConfirmedTime,
              rate: 0 as const,
            }
          : null,
      }),
      reportFailure: vi.fn(async () => {}),
    },
    owner,
    'file:///synthetic.mp4',
    start,
    { playing: false, rate: 1, audioTrack: 0, muted: true, volume: 1 },
    { pause: vi.fn(), restore, release: vi.fn() },
    presentation,
  );
  port.controller = controller;
  const acknowledge = (
    command: NativePlaybackIntent,
    time = command.targetTime,
  ): void => {
    snapshot = {
      ...snapshot,
      intent: command,
      lastConfirmedTime: time,
      observation: {
        ...owner,
        revision: ++revision,
        sequence: command.sequence,
        seekId: command.seekId,
        time,
        phase: command.playing ? 'playing' : 'paused',
        rate: command.playing ? command.rate : 0,
        reverseCapabilities: { slow: supportsReverse, fast: supportsReverse },
        audioTrack: 0,
        volume: 1,
        muted: true,
        videoReady: true,
        audioReady: true,
        error: null,
      },
    };
    listener(snapshot);
  };
  await vi.advanceTimersByTimeAsync(1);
  acknowledge(apply.mock.calls[0][0]);
  const onNativeControls = vi.fn();
  const onPause = vi.fn(),
    onSeek = vi.fn((time: number) => controller.seek(time));
  const videos = ['synthetic.mp4'];
  const hook = renderHook(
    ({ time }) =>
      useVideoReversePlayback({
        currentTime: time,
        minimumTime: 0,
        videoList: videos,
        onPause,
        onSeek,
        onNativeControls,
      }),
    { initialProps: { time: start } },
  );
  return {
    controller,
    apply,
    acknowledge,
    mediaFailure: () => listener({ ...snapshot, error: 'media' }),
    hook,
    onSeek,
    onPause,
    onNativeControls,
    close: async () => {
      hook.unmount();
      await vi.advanceTimersByTimeAsync(1);
      acknowledge(apply.mock.calls.at(-1)![0], controller.snapshot().time);
      await controller.returnToOriginal();
    },
  };
};

it.each([
  [0.5, 6000, 3],
  [2, 4000, 8],
  [4, 2000, 8],
  [6, 2000, 12],
])(
  'uses one native rate command for %sx over %sms and confirms decreasing clocks (simulated AVPlayer)',
  async (rate, duration, distance) => {
    const f = await setup(30, undefined, null, true);
    try {
      act(() =>
        f.hook.result.current.startReversePlayback(rate as 0.5 | 2 | 4 | 6),
      );
      await tick(0);
      const command = f.apply.mock.calls.at(-1)![0];
      expect(command).toMatchObject({
        playing: true,
        rate: -rate,
        seekId: 1,
        targetTime: 30,
      });
      const times: number[] = [];
      for (let t = 50; t <= duration; t += 50) {
        act(() => f.acknowledge(command, 30 - (rate * t) / 1000));
        times.push(f.controller.snapshot().time);
        await tick(t);
      }
      expect(times.every((time, i) => i === 0 || time < times[i - 1])).toBe(
        true,
      );
      expect(times.at(-1)).toBeCloseTo(30 - distance);
      expect(f.apply).toHaveBeenCalledTimes(2); // initial seek + rate, regardless of hold duration
      act(() => f.hook.result.current.finishReversePlayback());
      await tick(duration + 1);
      const stopped = f.apply.mock.calls.at(-1)![0];
      expect(stopped).toMatchObject({ playing: false, seekId: 1, rate: -rate });
      act(() => f.acknowledge(stopped, 30 - distance - 0.01));
      await tick(duration + 2);
      expect(f.controller.snapshot().time).toBeCloseTo(30 - distance - 0.01);
      expect(f.controller.requestedControls).toMatchObject({
        rate: 1,
        playing: false,
      });
      expect(f.onSeek).not.toHaveBeenCalled();
    } finally {
      await f.close();
    }
  },
);
it('changes native speed without issuing a seek and ignores an old stop after repress', async () => {
  const f = await setup(30, undefined, null, true);
  try {
    act(() => f.hook.result.current.startReversePlayback(0.5));
    await tick(0);
    act(() => f.hook.result.current.startReversePlayback(6));
    await tick(50);
    expect(f.apply.mock.calls.at(-1)![0]).toMatchObject({
      rate: -6,
      seekId: 1,
    });
    act(() => f.hook.result.current.finishReversePlayback());
    await tick(100);
    const oldStop = f.apply.mock.calls.at(-1)![0];
    act(() => f.hook.result.current.startReversePlayback(2));
    await tick(150);
    act(() => f.acknowledge(oldStop, 20));
    await tick(200);
    expect(f.controller.requestedControls).toMatchObject({
      rate: -2,
      playing: true,
    });
    expect(f.controller.snapshot().time).toBe(30);
  } finally {
    await f.close();
  }
});
it('waits for the in-flight image and drains the newest desired position after release', async () => {
  const f = await setup();
  try {
    act(() => f.hook.result.current.startReversePlayback(2));
    for (const t of [0, 50, 100, 150, 200]) await tick(t);
    expect(f.apply).toHaveBeenCalledTimes(2);
    const first = f.apply.mock.calls.at(-1)![0];
    expect(first.targetTime).toBeCloseTo(9.9);
    expect(f.controller.snapshot().time).toBe(10);
    act(() => f.hook.result.current.finishReversePlayback());
    act(() => f.acknowledge(first));
    await tick(250);
    expect(f.controller.snapshot().time).toBeCloseTo(9.9);
    const last = f.apply.mock.calls.at(-1)![0];
    expect(last.targetTime).toBeCloseTo(9.6);
    act(() => f.acknowledge(last));
    await tick(300);
    expect(f.controller.snapshot().time).toBeCloseTo(9.6);
    expect(f.apply).toHaveBeenCalledTimes(3);
  } finally {
    await f.close();
  }
});
it('does not let an old in-flight seek overwrite a new press or a separate seek', async () => {
  const f = await setup();
  try {
    act(() => f.hook.result.current.startReversePlayback(2));
    await tick(0);
    await tick(50);
    const old = f.apply.mock.calls.at(-1)![0];
    act(() => f.hook.result.current.finishReversePlayback());
    act(() => f.hook.result.current.startReversePlayback(6));
    await tick(100);
    await tick(150);
    const current = f.apply.mock.calls.at(-1)![0];
    act(() => f.acknowledge(old));
    await tick(200);
    expect(f.controller.snapshot().time).toBe(10);
    act(() => f.acknowledge(current));
    await tick(250);
    act(() => {
      f.controller.seek(25);
      window.dispatchEvent(new Event('video-seek-start'));
    });
    await tick(300);
    act(() => f.acknowledge(current));
    await tick(350);
    expect(f.controller.seekCommandTime).toBe(25);
  } finally {
    await f.close();
  }
});
it('finishes at zero and cancels queued work on source replacement', async () => {
  const f = await setup(0.05);
  try {
    act(() => f.hook.result.current.startReversePlayback(6));
    await tick(0);
    await tick(50);
    const last = f.apply.mock.calls.at(-1)![0];
    expect(last.targetTime).toBe(0);
    act(() => f.acknowledge(last));
    await tick(100);
    expect(f.controller.snapshot().time).toBe(0);
    expect(frames.size).toBe(0);
    act(() => f.controller.seek(10));
    await tick(150);
    act(() => f.acknowledge(f.apply.mock.calls.at(-1)![0]));
    f.hook.rerender({ time: 10 });
    act(() => f.hook.result.current.startReversePlayback(2));
    await tick(200);
    await tick(250);
    await tick(300);
    const stale = f.apply.mock.calls.at(-1)![0];
    f.hook.unmount();
    const count = f.apply.mock.calls.length;
    act(() => f.acknowledge(stale));
    await tick(350);
    expect(f.apply).toHaveBeenCalledTimes(count);
  } finally {
    await f.close();
  }
});
it('does not reset a new direction with an older native release completion', async () => {
  const f = await setup(30, undefined, null, true);
  try {
    act(() => f.hook.result.current.startReversePlayback(2));
    await tick(0);
    act(() => f.hook.result.current.finishReversePlayback());
    await tick(50);
    const old = f.apply.mock.calls.at(-1)![0];
    act(() => f.controller.controls({ playing: true, rate: 4 }));
    await tick(100);
    act(() => f.acknowledge(old, 29));
    await tick(150);
    expect(f.controller.requestedControls).toMatchObject({
      playing: true,
      rate: 4,
    });
  } finally {
    await f.close();
  }
});

it('keeps reverse ownership through an audio setting change and stops on release', async () => {
  const f = await setup(30, undefined, null, true);
  try {
    act(() => f.hook.result.current.startReversePlayback(2));
    await tick(0);
    act(() => f.controller.controls({ volume: 0.4, muted: false }));
    await tick(50);
    act(() => f.hook.result.current.finishReversePlayback());
    await tick(100);
    expect(f.controller.requestedControls).toMatchObject({
      playing: false,
      rate: -2,
      volume: 0.4,
      muted: false,
    });
  } finally {
    await f.close();
  }
});
it('stops continuous native reversal at the confirmed beginning without a seek', async () => {
  const f = await setup(0.05, undefined, null, true);
  try {
    act(() => f.hook.result.current.startReversePlayback(6));
    await tick(0);
    const command = f.apply.mock.calls.at(-1)![0];
    act(() => f.acknowledge({ ...command, playing: false }, 0));
    await tick(50);
    expect(f.controller.requestedControls).toMatchObject({
      playing: false,
      rate: 1,
    });
    expect(f.apply.mock.calls.every(([value]) => value.seekId === 1)).toBe(
      true,
    );
    expect(f.controller.snapshot().time).toBe(0);
  } finally {
    await f.close();
  }
});

it('does not overwrite a new control between the stop ACK and its promise continuation', async () => {
  const f = await setup(30, undefined, null, true);
  try {
    act(() => f.hook.result.current.startReversePlayback(2));
    await tick(0);
    act(() => f.hook.result.current.finishReversePlayback());
    await tick(50);
    const stop = f.apply.mock.calls.at(-1)![0];
    act(() => {
      f.acknowledge(stop, 29);
      f.controller.controls({ playing: true, rate: 4 });
    });
    await tick(100);
    expect(f.controller.requestedControls).toMatchObject({
      playing: true,
      rate: 4,
    });
  } finally {
    await f.close();
  }
});

it('does not start repeated seek after a started native reverse fails', async () => {
  const presentation: NativePlaybackPresentation = {
    width: 1920,
    height: 1080,
    start: 0,
    end: 100,
    seekEnd: 99,
    playEnd: 99.5,
    rates: [-2, 1],
    audioTracks: 3,
    seekGrid: null,
    mutedOnly: false,
    exactFloatVolume: false,
    audioSwitch: true,
  };
  const f = await setup(30, undefined, presentation, true);
  try {
    act(() => f.hook.result.current.startReversePlayback(2));
    await tick(0);
    const command = f.apply.mock.calls.at(-1)![0];
    act(() => f.acknowledge(command, 29));
    act(() => f.mediaFailure());
    for (const t of [50, 100, 150, 200, 250]) await tick(t);
    expect(f.onSeek).not.toHaveBeenCalled();
    expect(f.onNativeControls).toHaveBeenCalledWith(false, 1);
  } finally {
    await f.close();
  }
});

it('does not let failed-owner recovery stop a new native owner', async () => {
  const presentation: NativePlaybackPresentation = {
    width: 1920,
    height: 1080,
    start: 0,
    end: 100,
    seekEnd: 99,
    playEnd: 99.5,
    rates: [-2, 1],
    audioTracks: 3,
    seekGrid: null,
    mutedOnly: false,
    exactFloatVolume: false,
    audioSwitch: true,
  };
  const restore = vi.fn(async () => {
    port.controller = {} as NativePlaybackController;
  });
  const f = await setup(30, restore, presentation, true);
  try {
    act(() => f.hook.result.current.startReversePlayback(2));
    await tick(0);
    const command = f.apply.mock.calls.at(-1)![0];
    act(() => f.acknowledge(command, 29));
    act(() => f.mediaFailure());
    for (const t of [50, 100, 150, 200, 250]) await tick(t);
    expect(restore).toHaveBeenCalled();
    expect(f.onNativeControls).not.toHaveBeenCalledWith(false, 1);
  } finally {
    await f.close();
  }
});

it('does not normalize UI if a new control reenters during stop confirmation', async () => {
  const f = await setup(30, undefined, null, true);
  let unsubscribe = (): void => {};
  try {
    act(() => f.hook.result.current.startReversePlayback(2));
    await tick(0);
    act(() => f.hook.result.current.finishReversePlayback());
    await tick(50);
    const stop = f.apply.mock.calls.at(-1)![0];
    let issued = false;
    unsubscribe = f.controller.subscribe(() => {
      const intent = f.controller.requestedControls;
      if (!issued && !intent.playing && intent.rate === 1) {
        issued = true;
        f.controller.controls({ playing: true, rate: 4 });
      }
    });
    act(() => f.acknowledge(stop, 29));
    await tick(100);
    expect(issued).toBe(true);
    expect(f.controller.requestedControls).toMatchObject({
      playing: true,
      rate: 4,
    });
    expect(f.onNativeControls).not.toHaveBeenCalledWith(false, 1);
  } finally {
    unsubscribe();
    await f.close();
  }
});
