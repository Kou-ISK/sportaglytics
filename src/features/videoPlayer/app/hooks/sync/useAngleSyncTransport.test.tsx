// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import type { useAngleSyncDraft } from './useAngleSyncDraft';
import { useAngleSyncTransport } from './useAngleSyncTransport';

const make = (initialTime = 40) => {
  const controller: ReturnType<typeof useAngleSyncDraft> = {
    draft: {
      offsets: [0, 0],
      angles: [100, 300].map((durationSeconds, index) => ({
        id: `angle-${index}`,
        name: `Angle ${index}`,
        sourceKind: 'local',
        clips: [
          {
            id: `clip-${index}`,
            sourceKind: 'local',
            source: `media/${index}.mp4`,
            timelineStartSeconds: 0,
            gapBeforeSeconds: 0,
            durationSeconds,
          },
        ],
      })),
    },
    points: {},
    busy: false,
    saving: false,
    analyzing: false,
    changed: false,
    message: '',
    setMessage: vi.fn(),
    mark: vi.fn(),
    removePoint: vi.fn(),
    recordDuration: vi.fn(),
    align: () => null,
    refineAudio: async () => {},
    reset: vi.fn(),
    save: async () => {},
    cancel: vi.fn(),
  };
  return {
    controller,
    ...renderHook(
      (current) => useAngleSyncTransport(current, initialTime, true, 0),
      { initialProps: controller },
    ),
  };
};

it('accumulates accepted relative commands before React commit only on the selected angle', () => {
  const f = make();
  act(() => {
    for (let n = 0; n < 3; n++) f.result.current.seekRelative(10);
  });
  expect(f.result.current.times).toEqual([70, 40]);
  f.unmount();
});

it('uses the clamped angle endpoint for immediate reverse input', () => {
  const f = make(100);
  act(() => {
    f.result.current.seekRelative(10);
    f.result.current.seekRelative(-1);
  });
  expect(f.result.current.times).toEqual([99, 100]);
  f.unmount();
});

it('does not accumulate rejected busy or non-finite input', () => {
  const f = make();
  f.rerender({ ...f.controller, busy: true });
  act(() => f.result.current.seekRelative(10));
  expect(f.result.current.times).toEqual([40, 40]);
  f.rerender(f.controller);
  act(() => {
    f.result.current.seekRelative(Infinity);
    f.result.current.seekRelative(NaN);
    f.result.current.seekRelative(10);
  });
  expect(f.result.current.times).toEqual([50, 40]);
  f.unmount();
});

it('clamps all-angle relative input to the timeline range before reversing', () => {
  const f = make(0);
  act(() => f.result.current.select(null));
  act(() => {
    f.result.current.seekRelative(-1);
    f.result.current.seekRelative(10);
  });
  expect(f.result.current.times).toEqual([10, 10]);
  act(() => f.result.current.seek(300));
  act(() => {
    f.result.current.seekRelative(10);
    f.result.current.seekRelative(-1);
  });
  expect(f.result.current.times).toEqual([299, 299]);
  f.unmount();
});
