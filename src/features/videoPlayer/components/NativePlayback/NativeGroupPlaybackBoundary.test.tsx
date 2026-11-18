// @vitest-environment jsdom
import { useContext, useEffect } from 'react';
import type { ReactElement } from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { IElectronAPI } from '../../../../renderer';
import type { NativePlaybackAvailability } from '../../../../types/ipc/nativePlayback';
import type { NativeGroupPresentation } from '../../../../types/ipc/nativeGroupSurface';
import type { CachePlayerPort } from '../PlaybackCache/cachePlayerSwitch';
import { CachePlayerContext } from '../PlaybackCache/CachePlayerContext';
import { usePackagePlaybackClock } from '../../app/hooks/usePackagePlaybackClock';
import { NativeGroupPlaybackBoundary } from './NativeGroupPlaybackBoundary';
import { NativeSurfaceController } from './NativeSurfaceController';
import {
  getNativePlayback,
  getNativePlaybackGroup,
} from '../../shared/nativePlayback/nativePlaybackRegistry';
import { resolveNativeGroupTimeline } from '../../shared/nativePlayback/nativeGroupTimeline';
import { htmlPlaybackAllowed } from '../../shared/nativePlayback/playbackAuthority';
const owner = { generation: 'ordinary-pair', sourceKey: 'a'.repeat(64) };
const mediaAngles: import('../../../../types/package/media').PackageMediaAngle[] =
  ['left', 'right'].map((id, index) => ({
    id,
    name: id,
    sourceKind: 'local',
    clips: [
      {
        id: `${id}-clip`,
        sourceKind: 'local',
        source: 'file:///synthetic.mp4',
        gapBeforeSeconds: 0,
        timelineStartSeconds: 0,
        durationSeconds: 10 + index * 2,
      },
    ],
  }));
const sync = { syncOffset: 2, isAnalyzed: true };
const timeline = resolveNativeGroupTimeline(mediaAngles, sync);
if (!timeline) throw Error('fixture timeline');
const configuredTimeline = timeline;
const qualified = (): NativePlaybackAvailability => ({
  available: true,
  owner,
  sourceUrl: 'file:///native-group/opaque',
  sourceEnd: 10,
  reason: null,
  clockAuthority: 'drawn-pair',
  presentation: {
    width: 1920,
    height: 1080,
    start: 0,
    end: 10,
    seekEnd: 9.9,
    playEnd: 9.99,
    rates: [1, -0.5, -2, -4, -6],
    audioTracks: 3,
    seekGrid: null,
    mutedOnly: false,
    exactFloatVolume: false,
    audioSwitch: true,
  },
  group: {
    audioAngleId: 'left',
    angles: [
      {
        angleId: configuredTimeline.slots[0].angleId,
        clipId: configuredTimeline.slots[0].clipId,
        sourceUrl: configuredTimeline.slots[0].sourceUrl,
        sourceTimeOffset: 0,
        globalEnd: 10,
        globalStart: 0,
        sourceEnd: 10,
        audioTracks: 3,
      },
      {
        angleId: configuredTimeline.slots[1].angleId,
        clipId: configuredTimeline.slots[1].clipId,
        sourceUrl: configuredTimeline.slots[1].sourceUrl,
        sourceTimeOffset: 2,
        globalEnd: 10,
        globalStart: 0,
        sourceEnd: 12,
        audioTracks: 3,
      },
    ],
  },
});

const port = (initial = 3, duration = 10): CachePlayerPort => {
  let time = initial;
  return {
    source: () => 'file:///synthetic.mp4',
    time: () => time,
    duration: () => duration,
    paused: () => true,
    seeking: () => false,
    ready: () => 2,
    pause: vi.fn(),
    seek: vi.fn((t) => {
      time = t;
    }),
    setSource: vi.fn(),
    settings: () => ({
      rate: 1,
      volume: 0.5,
      muted: true,
      audio: [true, false, false],
    }),
    restore: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  };
};
const fixture = () => {
  const left = port(),
    right = port(5, 12);
  let present: ((pair: NativeGroupPresentation) => void) | null = null;
  const release = vi.fn();
  const bind = vi.fn<NonNullable<IElectronAPI['nativeGroupSurface']>['bind']>(
    (_ids, callback) => {
      present = callback;
      return release;
    },
  );
  const legacy = vi.fn();
  const inspect = vi.fn<
    NonNullable<IElectronAPI['nativePlayback']['inspectGroup']>
  >(async () => qualified());
  const api: IElectronAPI['nativePlayback'] = {
    inspect: vi.fn(),
    inspectGroup: inspect,
    freezePresentation: vi.fn(),
    open: vi.fn(async () => {}),
    apply: vi.fn(async () => {}),
    observe: vi.fn(async () => ({
      intent: null,
      observation: null,
      lastConfirmedTime: 3,
      error: null,
      closing: false,
      closed: false,
    })),
    onSnapshot: () => () => {},
    close: vi.fn<IElectronAPI['nativePlayback']['close']>(async () => ({
      generation: owner.generation,
      nativeDrained: true,
      processStarted: true,
      processExited: true,
      pipesClosed: true,
      stopped: null,
      presentedStop: {
        document: 'doc',
        generation: owner.generation,
        operation: 1,
        seekId: 1,
        pair: 1,
        globalTicks: 360000,
        ids: [1, 2],
      },
    })),
  };
  Object.defineProperty(window, 'electronAPI', {
    configurable: true,
    value: {
      nativePlayback: api,
      nativeGroupSurface: { bind },
      nativeSurface: { bind: legacy },
    },
  });
  const mounts = [document.createElement('div'), document.createElement('div')];
  mounts.forEach((m) => document.body.append(m));
  const Slot = ({
    id,
    player,
    mount,
  }: {
    id: string;
    player: CachePlayerPort;
    mount: Element;
  }): ReactElement => {
    const context = useContext(CachePlayerContext);
    useEffect(
      () =>
        context?.register({
          playerId: id,
          source: 'file:///synthetic.mp4',
          port: player,
          suppressMetadata: () => {},
        }),
      [context, id, player],
    );
    return (
      <NativeSurfaceController
        id={id}
        source="file:///synthetic.mp4"
        mount={mount}
      />
    );
  };
  const View = ({
    rightVisible = true,
  }: {
    rightVisible?: boolean;
  }): ReactElement => {
    usePackagePlaybackClock({
      mediaAngles,
      syncData: sync,
      syncMode: 'auto',
      isVideoPlaying: false,
      videoPlayBackRate: 1,
      currentTime: 3,
      setCurrentTime: () => {},
      setIsVideoPlaying: () => {},
      setMaxSec: () => {},
    });
    return (
      <NativeGroupPlaybackBoundary
        timeline={configuredTimeline}
        playing={false}
        time={3}
        pause={() => {}}
        restored={() => {}}
      >
        <Slot id="video_0" player={left} mount={mounts[0]} />
        {rightVisible && <Slot id="video_1" player={right} mount={mounts[1]} />}
      </NativeGroupPlaybackBoundary>
    );
  };
  return {
    left,
    right,
    mounts,
    bind,
    release,
    legacy,
    inspect,
    api,
    View,
    present: (pair: NativeGroupPresentation): void => {
      present?.(pair);
    },
  };
};
beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
});
afterEach(async () => {
  const controller = getNativePlayback();
  if (controller)
    await act(async () => {
      await controller.returnToOriginal();
    });
  cleanup();
  document.body.replaceChildren();
  Reflect.deleteProperty(window, 'electronAPI');
  vi.useRealTimers();
  vi.restoreAllMocks();
});
it('connects two ordinary same-URL slots through one pair binding and actual Controller, never legacy', async () => {
  const f = fixture();
  render(<f.View />);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1);
  });
  expect(f.bind).toHaveBeenCalledOnce();
  expect(f.bind.mock.calls[0][0]).toEqual([
    'video_0-native-group-surface',
    'video_1-native-group-surface',
  ]);
  expect(f.legacy).not.toHaveBeenCalled();
  expect(f.inspect).toHaveBeenCalledWith({
    angleIds: ['left', 'right'],
    audioAngleId: 'left',
  });
  expect(f.api.open).toHaveBeenCalledOnce();
  expect(getNativePlayback()?.snapshot().error).toBeNull();
  expect(getNativePlaybackGroup()?.angles.map((a) => a.angleId)).toEqual([
    'left',
    'right',
  ]);
  expect(htmlPlaybackAllowed()).toBe(false);
  const canvases = f.mounts.map((m) => m.querySelector('canvas'));
  expect(canvases.map((c) => c?.style.visibility)).toEqual([
    'hidden',
    'hidden',
  ]);
  await act(async () =>
    f.present({
      document: 'doc',
      generation: 'foreign',
      operation: 1,
      seekId: 1,
      pair: 1,
      globalTicks: 360000,
      ids: [1, 2],
    }),
  );
  expect(canvases.map((c) => c?.style.visibility)).toEqual([
    'hidden',
    'hidden',
  ]);
  await act(async () =>
    f.present({
      document: 'doc',
      generation: owner.generation,
      operation: 1,
      seekId: 1,
      pair: 1,
      globalTicks: 360000,
      ids: [1, 2],
    }),
  );
  expect(canvases.map((c) => c?.style.visibility)).toEqual([
    'visible',
    'visible',
  ]);
  await act(async () => {
    await getNativePlayback()?.returnToOriginal();
  });
  expect(f.left.seek).toHaveBeenCalledWith(3);
  expect(f.right.seek).toHaveBeenCalledWith(5);
  expect(htmlPlaybackAllowed()).toBe(true);
});
it('does not inspect/open until both actual canvases and player ports exist', async () => {
  const f = fixture();
  render(<f.View rightVisible={false} />);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1);
  });
  expect(f.bind).not.toHaveBeenCalled();
  expect(f.inspect).not.toHaveBeenCalled();
  expect(f.api.open).not.toHaveBeenCalled();
});
it('ignores qualification resolved after the owning slots unmount', async () => {
  const f = fixture(),
    pending = Promise.withResolvers<NativePlaybackAvailability>();
  f.inspect.mockReturnValue(pending.promise);
  const ui = render(<f.View />);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1);
  });
  expect(f.inspect).toHaveBeenCalledOnce();
  ui.unmount();
  await act(async () => {
    pending.resolve(qualified());
    await vi.advanceTimersByTimeAsync(1);
  });
  expect(f.api.open).not.toHaveBeenCalled();
  expect(f.release).toHaveBeenCalledOnce();
});
it('keeps old or different clip qualification on original playback', async () => {
  const f = fixture(),
    value = qualified();
  if (!value.group) throw Error('fixture');
  value.group.angles[1].clipId = 'old';
  f.inspect.mockResolvedValue(value);
  render(<f.View />);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1);
  });
  expect(f.api.open).not.toHaveBeenCalled();
  expect(htmlPlaybackAllowed()).toBe(true);
});

it('does not replace a live pair for an equivalent ordinary screen rerender', async () => {
  const f = fixture(),
    ui = render(<f.View />);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1);
  });
  const controller = getNativePlayback();
  expect(controller).not.toBeNull();
  ui.rerender(<f.View />);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1);
  });
  expect(f.bind).toHaveBeenCalledOnce();
  expect(f.api.open).toHaveBeenCalledOnce();
  expect(getNativePlayback()).toBe(controller);
  expect(controller?.snapshot().error).toBeNull();
});
it('does not silently choose between two audible originals', async () => {
  const f = fixture();
  vi.spyOn(f.left, 'settings').mockReturnValue({
    rate: 1,
    volume: 0.5,
    muted: false,
    audio: [true, false, false],
  });
  vi.spyOn(f.right, 'settings').mockReturnValue({
    rate: 1,
    volume: 0.5,
    muted: false,
    audio: [true, false, false],
  });
  render(<f.View />);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1);
  });
  expect(f.inspect).not.toHaveBeenCalled();
  expect(f.api.open).not.toHaveBeenCalled();
  expect(htmlPlaybackAllowed()).toBe(true);
});

it('rejects a disposed original during pending React cleanup without opening or crashing the screen', async () => {
  const f = fixture();
  vi.spyOn(f.right, 'settings').mockImplementation(() => {
    throw Error('disposed');
  });
  render(<f.View />);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1);
  });
  expect(f.api.open).not.toHaveBeenCalled();
  expect(htmlPlaybackAllowed()).toBe(true);
});

it('shows a safe fallback warning when opening lacks the mandatory presentation fence', async () => {
  const f = fixture();
  f.api.freezePresentation = undefined;
  render(<f.View />);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1);
  });
  expect(f.api.open).not.toHaveBeenCalled();
  expect(htmlPlaybackAllowed()).toBe(true);
  expect(screen.getByRole('alert').textContent).toContain('互換再生を使用');
});

it('defers group qualification and opening while hidden, then starts once naturally visible', async () => {
  let visibility: DocumentVisibilityState = 'hidden';
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(
    () => visibility,
  );
  const f = fixture();
  render(<f.View />);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1);
  });
  expect(f.inspect).not.toHaveBeenCalled();
  expect(f.api.open).not.toHaveBeenCalled();
  await act(async () => {
    visibility = 'visible';
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(1);
  });
  expect(f.inspect).toHaveBeenCalledOnce();
  expect(f.api.open).toHaveBeenCalledOnce();
});
it('does not consume a qualification resolved after hiding or lose the next visible attempt', async () => {
  let visibility: DocumentVisibilityState = 'visible';
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(
    () => visibility,
  );
  const f = fixture(),
    pending = Promise.withResolvers<NativePlaybackAvailability>();
  f.inspect.mockReturnValueOnce(pending.promise);
  render(<f.View />);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1);
  });
  await act(async () => {
    visibility = 'hidden';
    document.dispatchEvent(new Event('visibilitychange'));
    pending.resolve(qualified());
    await vi.advanceTimersByTimeAsync(1);
  });
  expect(f.api.open).not.toHaveBeenCalled();
  await act(async () => {
    visibility = 'visible';
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(1);
  });
  expect(f.api.open).toHaveBeenCalledOnce();
});
