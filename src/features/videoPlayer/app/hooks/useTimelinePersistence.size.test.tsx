// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MAX_PACKAGE_JSON_BYTES } from '../../../../shared/packageJsonLimits';
import { registerTimelineCloseHandler } from '../gateways/timelineCloseGateway';
import { useTimelinePersistence } from './useTimelinePersistence';

vi.mock('../gateways/timelineCloseGateway', () => ({
  registerTimelineCloseHandler: vi.fn(() => () => undefined),
}));
const originalElectronApi = Object.getOwnPropertyDescriptor(
  window,
  'electronAPI',
);
afterEach(() => {
  cleanup();
  if (originalElectronApi)
    Object.defineProperty(window, 'electronAPI', originalElectronApi);
  else Reflect.deleteProperty(window, 'electronAPI');
  vi.useRealTimers();
  vi.clearAllMocks();
});

it('retains edits and the original when the real size guard fails autosave/close, then permits a smaller retry', async () => {
  vi.useFakeTimers();
  const initial = JSON.stringify({ version: 2, rows: [], instances: [] });
  let disk = initial;
  const writeTextFile = vi.fn(async (_file: string, text: string) => {
    disk = text;
    return true;
  });
  // Keep the actual gateway/encoder guard; only the Electron transport is fake.
  Object.defineProperty(window, 'electronAPI', {
    configurable: true,
    value: { readTextFile: async () => disk, writeTextFile },
  });
  const hook = renderHook(() => useTimelinePersistence());
  await act(async () =>
    hook.result.current.setTimelineFilePath('/synthetic/timeline.json'),
  );
  const handlers = vi.mocked(registerTimelineCloseHandler).mock.calls.at(-1);
  if (!handlers) throw new Error('Close handler missing');
  const [flush, resume] = handlers;
  const item = {
    id: 'synthetic',
    actionName: 'Synthetic',
    startTime: 0,
    endTime: 1,
    // UTF-16 length is below the byte limit; Japanese text still exceeds it.
    memo: 'あ'.repeat(Math.floor(MAX_PACKAGE_JSON_BYTES / 3) + 1),
  };
  act(() => hook.result.current.setTimeline([item]));
  await act(async () => vi.advanceTimersByTimeAsync(301));
  expect(writeTextFile).not.toHaveBeenCalled();
  expect(disk).toBe(initial);
  expect(hook.result.current.timeline[0].memo === item.memo).toBe(true);
  expect(hook.result.current.persistenceFeedback?.message).toContain(
    '16 MiB（UTF-8）',
  );
  await act(async () => expect(await flush()).toBe(false));
  expect(writeTextFile).not.toHaveBeenCalled();
  expect(disk).toBe(initial);
  act(resume);
  expect(hook.result.current.canEditTimeline()).toBe(true);
  act(() =>
    hook.result.current.setTimeline([
      { ...item, memo: 'Retained after a smaller retry' },
    ]),
  );
  await act(async () => expect(await flush()).toBe(true));
  expect(writeTextFile).toHaveBeenCalledOnce();
  expect(JSON.parse(disk).instances[0].memo).toBe(
    'Retained after a smaller retry',
  );
  expect(hook.result.current.persistenceFeedback).toBeNull();
});
