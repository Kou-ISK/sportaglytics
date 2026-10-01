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
