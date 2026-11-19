// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { useScrubPreview } from './useScrubPreview';

vi.mock('../../shared/videojs/videoJsAdapter', () => ({
  getVideoJsPlayer: () => ({ el: () => document.body }),
}));

it('releases unfinished work on media play before React reports playing', async () => {
  vi.useFakeTimers();
  const original = Object.getOwnPropertyDescriptor(window, 'electronAPI');
  const prepare = vi.fn(() => new Promise<null>(() => {}));
  const release = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(window, 'electronAPI', {
    configurable: true,
    value: { scrubPreview: { prepare, release } },
  });
  const source = 'file:///fixture.mp4';
  const video = document.createElement('video');
  document.body.append(video);
  Object.defineProperties(video, {
    currentSrc: { value: source },
    readyState: { value: 4 },
    videoWidth: { value: 1920 },
    videoHeight: { value: 1080 },
  });
  const angles = [
    {
      id: 'a',
      name: 'angle',
      sourceKind: 'local' as const,
      clips: [
        {
          id: 'v',
          source,
          sourceKind: 'local' as const,
          timelineStartSeconds: 0,
          gapBeforeSeconds: 0,
          durationSeconds: 20,
        },
      ],
    },
  ];
  const hook = renderHook(() =>
    useScrubPreview([source], angles, undefined, 'auto', 5, false),
  );
  try {
    await act(() => vi.advanceTimersByTimeAsync(1801));
    expect(prepare).toHaveBeenCalledOnce();
    act(() => {
      video.dispatchEvent(new Event('play'));
    });
    expect(release).toHaveBeenCalledOnce();
    expect(hook.result.current.current).toBeNull();
  } finally {
    hook.unmount();
    video.remove();
    if (original) Object.defineProperty(window, 'electronAPI', original);
    else Reflect.deleteProperty(window, 'electronAPI');
    vi.useRealTimers();
  }
});
