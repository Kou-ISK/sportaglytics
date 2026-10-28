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
import { recordNativePresentedFrame } from '../../shared/nativePlayback/nativePresentedFrame';

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
  const prepareSeek = vi.fn();
  const controller = new NativePlaybackController(
    {
      inspect: vi.fn(),
      open: vi.fn(async () => {}),
      apply,
      prepareSeek,
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
  const acknowledge = (command: NativePlaybackIntent): void => {
    snapshot = {
      ...snapshot,
      intent: command,
      lastConfirmedTime: command.targetTime,
      observation: {
        ...owner,
        revision: ++revision,
        sequence: command.sequence,
        seekId: command.seekId,
        time: command.targetTime,
        phase: 'paused',
        rate: 0,
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
      }),
    { initialProps: { time: start } },
  );
  return {
    controller,
    apply,
    prepareSeek,
    acknowledge,
    mediaFailure: () => listener({ ...snapshot, error: 'media' }),
    hook,
    onSeek,
    onPause,
    close: async () => {
      hook.unmount();
      await controller.returnToOriginal();
    },
  };
};

const show = (f: Awaited<ReturnType<typeof setup>>, time: number): void => {
  recordNativePresentedFrame(f.controller, {
    generation: f.controller.owner.generation,
    seekId: 1,
    pts: Math.round(time * 120000),
    timescale: 120000,
  });
};
const hold = async (f: Awaited<ReturnType<typeof setup>>): Promise<void> => {
  act(() => f.hook.result.current.startReversePlayback(2));
  await tick(0);
  await tick(50);
  const first = f.apply.mock.calls.at(-1)![0];
  act(() => {
    show(f, first.targetTime);
    f.acknowledge(first);
  });
  await tick(100);
};
it('freezes at the displayed image on release and rejects the late old observation', async () => {
  const f = await setup();
  try {
    await hold(f);
    const stale = f.apply.mock.calls.at(-1)![0];
    act(() => f.hook.result.current.finishReversePlayback());
    await vi.advanceTimersByTimeAsync(1);
    expect(f.apply.mock.calls.at(-1)![0].targetTime).toBeCloseTo(9.9, 8);
    act(() => f.acknowledge(stale));
    expect(f.controller.snapshot().time).toBeCloseTo(9.9, 8);
    expect(frames.size).toBe(0);
  } finally {
    await f.close();
  }
});
it('uses the drawn image before its clock ACK arrives', async () => {
  const f = await setup();
  try {
    act(() => f.hook.result.current.startReversePlayback(2));
    await tick(0);
    await tick(50);
    show(f, 9.9);
    await tick(100);
    act(() => f.hook.result.current.finishReversePlayback());
    await vi.advanceTimersByTimeAsync(1);
    expect(f.apply.mock.calls.at(-1)![0].targetTime).toBeCloseTo(9.9, 8);
  } finally {
    await f.close();
  }
});
it('reanchors an immediate repress without a changed React clock', async () => {
  const f = await setup();
  try {
    await hold(f);
    act(() => f.hook.result.current.finishReversePlayback());
    await vi.advanceTimersByTimeAsync(1);
    act(() => f.hook.result.current.startReversePlayback(2));
    await tick(200);
    await tick(250);
    expect(f.onSeek.mock.calls.at(-1)![0]).toBeCloseTo(9.8, 8);
  } finally {
    await f.close();
  }
});
it.each(['seek', 'same-seek', 'play', 'rate', 'audio', 'unmount'] as const)(
  'does not replace another %s operation',
  async (op) => {
    const f = await setup();
    try {
      await hold(f);
      act(() => {
        if (op === 'seek') f.controller.seek(25);
        if (op === 'same-seek') f.controller.seek(f.controller.seekCommandTime);
        if (op === 'play') f.controller.controls({ playing: true });
        if (op === 'rate') f.controller.controls({ rate: 2 });
        if (op === 'audio') f.controller.controls({ audioTrack: 1 });
        if (op === 'unmount') f.hook.unmount();
      });
      await vi.advanceTimersByTimeAsync(1);
      const count = f.apply.mock.calls.length;
      act(() => f.hook.result.current.finishReversePlayback());
      await vi.advanceTimersByTimeAsync(1);
      expect(f.apply).toHaveBeenCalledTimes(count);
    } finally {
      await f.close();
    }
  },
);
it('preserves the pending lower-bound seek on release', async () => {
  const f = await setup(0.05);
  try {
    act(() => f.hook.result.current.startReversePlayback(6));
    await tick(0);
    await tick(50);
    const count = f.apply.mock.calls.length;
    act(() => f.hook.result.current.finishReversePlayback());
    await vi.advanceTimersByTimeAsync(1);
    expect(f.apply).toHaveBeenCalledTimes(count);
    expect(f.apply.mock.calls.at(-1)![0].targetTime).toBe(0);
  } finally {
    await f.close();
  }
});
it.each([0.5, 2, 4, 6] as const)(
  'preserves every held %s request without waiting for image ACKs',
  async (rate) => {
    const f = await setup();
    try {
      act(() => f.hook.result.current.startReversePlayback(rate));
      for (const t of [0, 50, 100, 150]) await tick(t);
      expect(f.onSeek.mock.calls.map(([t]) => Number(t.toFixed(6)))).toEqual(
        [10 - rate * 0.05, 10 - rate * 0.1, 10 - rate * 0.15].map((t) =>
          Number(t.toFixed(6)),
        ),
      );
      expect(f.apply).toHaveBeenCalledTimes(4);
    } finally {
      await f.close();
    }
  },
);

it('does not claim a reentrant seek issued by another input listener', async () => {
  const f = await setup();
  try {
    f.onSeek.mockImplementation((time) => {
      f.controller.seek(time);
      f.controller.seek(25);
    });
    act(() => f.hook.result.current.startReversePlayback(2));
    await tick(0);
    await tick(50);
    await tick(100);
    act(() => f.hook.result.current.finishReversePlayback());
    await vi.advanceTimersByTimeAsync(1);
    expect(f.onSeek).toHaveBeenCalledOnce();
    expect(f.controller.seekCommandTime).toBe(25);
  } finally {
    await f.close();
  }
});
it('keeps reverse inputs working while original-source recovery is pending', async () => {
  const pending = Promise.withResolvers<void>();
  const f = await setup(
    10,
    vi.fn(() => pending.promise),
    {
      width: 1920,
      height: 1080,
      start: 0,
      end: 30,
      seekEnd: 29,
      playEnd: 29.5,
      rates: [1],
      audioTracks: 3,
      seekGrid: null,
      mutedOnly: true,
      exactFloatVolume: true,
      audioSwitch: false,
    },
  );
  f.controller.seek(40);
  try {
    await vi.advanceTimersByTimeAsync(1);
    act(() => f.hook.result.current.startReversePlayback(2));
    await tick(0);
    await tick(50);
    expect(f.onSeek).toHaveBeenCalledWith(9.9);
    expect(f.controller.seekCommandTime).toBe(9.9);
    act(() => f.hook.result.current.finishReversePlayback());
    expect(f.controller.seekCommandTime).toBe(9.9);
  } finally {
    pending.resolve();
    await f.close();
  }
});

it('keeps a replacement reverse gesture started by a synchronous listener', async () => {
  const f = await setup();
  try {
    f.onSeek.mockImplementationOnce((time) => {
      f.controller.seek(time);
      f.hook.result.current.startReversePlayback(0.5);
    });
    act(() => f.hook.result.current.startReversePlayback(2));
    await tick(0);
    await tick(50);
    await tick(100);
    await tick(150);
    expect(f.onSeek.mock.calls.map(([t]) => t)).toEqual([9.9, 9.875]);
    expect(frames.size).toBe(1);
    act(() => f.hook.result.current.finishReversePlayback());
    expect(frames.size).toBe(0);
  } finally {
    await f.close();
  }
});
it('continues the existing input route if asynchronous media fallback starts during a hold', async () => {
  const pending = Promise.withResolvers<void>();
  const f = await setup(
    10,
    vi.fn(() => pending.promise),
    {
      width: 1920,
      height: 1080,
      start: 0,
      end: 30,
      seekEnd: 29,
      playEnd: 29.5,
      rates: [1],
      audioTracks: 3,
      seekGrid: null,
      mutedOnly: true,
      exactFloatVolume: true,
      audioSwitch: false,
    },
  );
  try {
    act(() => f.hook.result.current.startReversePlayback(2));
    await tick(0);
    await tick(50);
    act(() => f.mediaFailure());
    await tick(100);
    expect(f.onSeek.mock.calls.map(([t]) => Number(t.toFixed(3)))).toEqual([
      9.9, 9.8,
    ]);
    expect(f.controller.seekCommandTime).toBeCloseTo(9.8);
    act(() => f.hook.result.current.finishReversePlayback());
    expect(f.controller.seekCommandTime).toBeCloseTo(9.8);
  } finally {
    pending.resolve();
    await f.close();
  }
});

it('prepares image rejection synchronously while the previous IPC apply is unresolved', async () => {
  const f = await setup();
  const pending = Promise.withResolvers<void>();
  try {
    await hold(f);
    f.apply.mockImplementationOnce(() => pending.promise);
    await tick(150);
    const count = f.apply.mock.calls.length;
    act(() => f.hook.result.current.finishReversePlayback());
    expect(f.prepareSeek).toHaveBeenCalledOnce();
    expect(f.prepareSeek.mock.calls[0][0].targetTime).toBeCloseTo(9.9, 8);
    expect(f.apply).toHaveBeenCalledTimes(count);
    expect(f.controller.hasConfirmedSeek).toBe(false);
    pending.resolve();
    await vi.advanceTimersByTimeAsync(1);
    expect(f.apply).toHaveBeenCalledTimes(count + 1);
    expect(f.apply.mock.calls.at(-1)![0]).toEqual(
      f.prepareSeek.mock.calls[0][0],
    );
  } finally {
    pending.resolve();
    await f.close();
  }
});
it('reports admission failure without claiming a confirmed release position', async () => {
  const f = await setup();
  try {
    await hold(f);
    f.prepareSeek.mockImplementation(() => {
      throw Error('detached surface');
    });
    act(() => f.hook.result.current.finishReversePlayback());
    expect(f.controller.snapshot().phase).toBe('failed');
    expect(f.controller.snapshot().error).toBe('NATIVE_FRAME_ADMISSION_FAILED');
    expect(f.controller.snapshot().time).toBeCloseTo(9.9, 8);
    expect(f.controller.hasConfirmedSeek).toBe(false);
    expect(frames.size).toBe(0);
  } finally {
    await f.close();
  }
});
