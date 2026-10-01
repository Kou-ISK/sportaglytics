// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useTimelinePersistence } from './useTimelinePersistence';
import {
  readTimelineFile,
  writeTimelineFile,
} from '../gateways/timelineImportExportGateway';
vi.mock('../gateways/timelineImportExportGateway', () => ({
  readTimelineFile: vi.fn(),
  writeTimelineFile: vi.fn(),
}));
const initial = JSON.stringify({ version: 2, rows: [], instances: [] });
beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(readTimelineFile).mockResolvedValue(initial);
  vi.mocked(writeTimelineFile).mockResolvedValue(true);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.resetAllMocks();
});
const load = async () => {
  const hook = renderHook(() => useTimelinePersistence());
  await act(async () =>
    hook.result.current.setTimelineFilePath('/synthetic/timeline.json'),
  );
  return hook;
};
it.each([
  null,
  '{broken',
  '{"version":99,"rows":[],"instances":[]}',
  '{"unrelated":true}',
])('blocks autosave after an inaccessible or invalid read: %s', async (bad) => {
  vi.mocked(readTimelineFile).mockResolvedValue(bad);
  const hook = await load();
  await act(async () => {
    hook.result.current.setTimelineRows([
      { id: 'r', name: 'Unsaved', color: '#123456' },
    ]);
    await vi.advanceTimersByTimeAsync(1000);
  });
  expect(writeTimelineFile).not.toHaveBeenCalled();
  expect(hook.result.current.persistenceFeedback?.kind).toBe('load-error');
  vi.mocked(readTimelineFile).mockResolvedValue(initial);
  await act(async () => hook.result.current.persistenceFeedback?.onRetry());
  expect(hook.result.current.persistenceFeedback).toBeNull();
  expect(hook.result.current.timelineRows).toEqual([]);
  await act(async () => vi.advanceTimersByTimeAsync(1000));
  expect(writeTimelineFile).not.toHaveBeenCalled();
});
it('keeps an unsaved edit visible and retries a failed write', async () => {
  const hook = await load();
  vi.mocked(writeTimelineFile).mockResolvedValueOnce(false);
  const edit = [
    {
      id: 'one',
      actionName: 'Attack',
      startTime: 1,
      endTime: 2,
      memo: '日本語 🏉',
    },
  ];
  await act(async () => {
    hook.result.current.setTimeline(edit);
  });
  await act(async () => vi.advanceTimersByTimeAsync(301));
  expect(hook.result.current.timeline).toEqual(edit);
  expect(hook.result.current.persistenceFeedback?.kind).toBe('save-error');
  await act(async () => {
    hook.result.current.persistenceFeedback?.onRetry();
  });
  await act(async () => vi.advanceTimersByTimeAsync(301));
  expect(writeTimelineFile).toHaveBeenLastCalledWith(
    '/synthetic/timeline.json',
    expect.stringContaining('日本語 🏉'),
  );
  expect(hook.result.current.persistenceFeedback).toBeNull();
});
it('serializes writes and prevents a late edit from replacing the newer document', async () => {
  const hook = await load();
  let finish: ((value: boolean) => void) | undefined;
  vi.mocked(writeTimelineFile).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await act(async () => {
    hook.result.current.setTimelineRows([
      { id: 'one', name: 'First', color: '#123456' },
    ]);
  });
  await act(async () => vi.advanceTimersByTimeAsync(301));
  await act(async () => {
    hook.result.current.setTimelineRows([
      { id: 'one', name: 'Second', color: '#123456' },
    ]);
  });
  await act(async () => vi.advanceTimersByTimeAsync(301));
  expect(writeTimelineFile).toHaveBeenCalledTimes(1);
  await act(async () => finish?.(true));
  expect(writeTimelineFile).toHaveBeenCalledTimes(2);
  expect(writeTimelineFile).toHaveBeenLastCalledWith(
    '/synthetic/timeline.json',
    expect.stringContaining('Second'),
  );
});

it.each([false, true])(
  'persists Undo to A while B is in flight (completion before debounce: %s)',
  async (completeBeforeDebounce) => {
    let disk = initial;
    let release: (() => void) | undefined;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    let writes = 0;
    vi.mocked(readTimelineFile).mockImplementation(async () => disk);
    vi.mocked(writeTimelineFile).mockImplementation(async (_file, snapshot) => {
      if (++writes === 1) await pending;
      disk = snapshot;
      return true;
    });
    const hook = await load();
    act(() =>
      hook.result.current.setTimelineRows([
        { id: 'r', name: 'Edit B', color: '#123456' },
      ]),
    );
    await act(async () => vi.advanceTimersByTimeAsync(301));
    expect(writes).toBe(1);
    act(() => hook.result.current.setTimelineRows([]));
    if (completeBeforeDebounce) await act(async () => release?.());
    await act(async () => vi.advanceTimersByTimeAsync(301));
    if (!completeBeforeDebounce) await act(async () => release?.());
    await act(async () => vi.advanceTimersByTimeAsync(1000));
    expect(hook.result.current.timelineRows).toEqual([]);
    expect(JSON.parse(disk)).toEqual(JSON.parse(initial));
    hook.unmount();
    const reopened = await load();
    expect(reopened.result.current.timelineRows).toEqual([]);
  },
);
