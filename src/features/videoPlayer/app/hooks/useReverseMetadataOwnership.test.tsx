// @vitest-environment jsdom
import { useState } from 'react';
import { act, renderHook } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { useVideoTimeController } from './useVideoTimeController';
import { updateTimelineClipDuration } from '../../components/Player/SyncedVideo/updateTimelineClipDuration';
import type { PackageMediaAngle } from '../../../../types/package/metadata';

vi.mock('../../shared/videojs/videoJsAdapter', () => ({
  getVideoJsPlayer: vi.fn(), setVideoJsPlayerCurrentTime: vi.fn(),
}));
vi.mock('../../../../shared/media/waitForVideoPresentation', () => ({
  waitForVideoPresentation: (_targets: unknown, signal: AbortSignal, seek: () => void) =>
    new Promise<number | null>((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(new Error('REVERSE_CANCELLED')), { once: true });
      seek();
    }),
}));

it('keeps the owner for unchanged metadata, but cancels on a real timeline change', async () => {
  const angles: PackageMediaAngle[] = [0, 1].map((i) => ({
    id: `a${i}`, name: `a${i}`, sourceKind: 'local',
    clips: [{ id: `c${i}`, sourceKind: 'local', source: `/a${i}.mp4`,
      gapBeforeSeconds: 0, timelineStartSeconds: 0, durationSeconds: 10 }],
  }));
  const videos: string[] = [];
  const hook = renderHook(() => {
    const [mediaAngles, setAngles] = useState(angles);
    const controller = useVideoTimeController({ videoList: videos, mediaAngles, syncData: undefined, syncMode: 'auto' });
    return { controller, setAngles };
  });
  let work!: Promise<number | null>;
  act(() => { work = hook.result.current.controller.seekReverse(3, new AbortController().signal); });
  const rejected = vi.fn();
  void work.catch(rejected);
  await act(async () => {
    hook.result.current.setAngles((current) => updateTimelineClipDuration(current, 0, 'c0', 10));
    await Promise.resolve();
  });
  expect(rejected).not.toHaveBeenCalled();
  act(() => {
    hook.result.current.setAngles((current) => updateTimelineClipDuration(current, 0, 'c0', 12));
  });
  await expect(work).rejects.toThrow('REVERSE_CANCELLED');
  expect(rejected).toHaveBeenCalledOnce();
  hook.unmount();
});
