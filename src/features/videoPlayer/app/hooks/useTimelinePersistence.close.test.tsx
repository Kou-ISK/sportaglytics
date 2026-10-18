// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useTimelinePersistence } from './useTimelinePersistence';
import { registerTimelineCloseHandler } from '../gateways/timelineCloseGateway';
import {
  readTimelineFile,
  writeTimelineFile,
} from '../gateways/timelineImportExportGateway';

vi.mock('../gateways/timelineCloseGateway', () => ({
  registerTimelineCloseHandler: vi.fn(() => () => undefined),
}));
vi.mock('../gateways/timelineImportExportGateway', () => ({
  readTimelineFile: vi.fn(),
  writeTimelineFile: vi.fn(),
}));
const initial = JSON.stringify({ version: 2, rows: [], instances: [] });
const row = { id: 'r', name: 'Synthetic edit', color: '#123456' };
let disk: string;
beforeEach(() => {
  vi.useFakeTimers();
  disk = initial;
  vi.mocked(readTimelineFile).mockImplementation(async () => disk);
  vi.mocked(writeTimelineFile).mockImplementation(async (_path, text) => {
    disk = text;
    return true;
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});
const load = async () => {
  const hook = renderHook(() => useTimelinePersistence());
  await act(async () =>
    hook.result.current.setTimelineFilePath('/synthetic/timeline.json'),
  );
  const handlers = vi.mocked(registerTimelineCloseHandler).mock.calls.at(-1);
  if (!handlers) throw new Error('Close handshake was not registered');
  return { hook, flush: handlers[0], resume: handlers[1] };
};

it.each([0, 100, 299])(
  'flushes a close at %d ms before debounce and reopens the last edit',
  async (elapsed) => {
    const { hook, flush } = await load();
    act(() => hook.result.current.setTimelineRows([row]));
    await act(async () => vi.advanceTimersByTimeAsync(elapsed));
    expect(writeTimelineFile).not.toHaveBeenCalled();
    await act(async () => expect(await flush()).toBe(true));
    expect(writeTimelineFile).toHaveBeenCalledTimes(1);
    hook.unmount();
    const reopened = await load();
    expect(reopened.hook.result.current.timelineRows).toEqual([row]);
  },
);

it('includes an edit before React commits and freezes new edits until cancellation', async () => {
  const { hook, flush, resume } = await load();
  await act(async () => {
    hook.result.current.setTimelineRows([row]);
    const completion = flush();
    hook.result.current.setTimelineRows([]);
    expect(await completion).toBe(true);
  });
  expect(JSON.parse(disk).rows).toEqual([row]);
  expect(hook.result.current.canEditTimeline()).toBe(false);
  act(resume);
  expect(hook.result.current.canEditTimeline()).toBe(true);
  act(() => hook.result.current.setTimelineRows([]));
  await act(async () => expect(await flush()).toBe(true));
  expect(JSON.parse(disk).rows).toEqual([]);
});

it('does not write a clean document when closing', async () => {
  const { flush } = await load();
  await act(async () => expect(await flush()).toBe(true));
  expect(writeTimelineFile).not.toHaveBeenCalled();
});

it('fails close, retains the edit, and can save on the next close after cancellation', async () => {
  const { hook, flush, resume } = await load();
  act(() => hook.result.current.setTimelineRows([row]));
  vi.mocked(writeTimelineFile).mockResolvedValueOnce(false);
  await act(async () => expect(await flush()).toBe(false));
  expect(disk).toBe(initial);
  expect(hook.result.current.timelineRows).toEqual([row]);
  expect(hook.result.current.persistenceFeedback?.kind).toBe('save-error');
  act(resume);
  expect(hook.result.current.timelineEditable).toBe(true);
  await act(async () => expect(await flush()).toBe(true));
  expect(JSON.parse(disk).rows).toEqual([row]);
  expect(hook.result.current.persistenceFeedback).toBeNull();
});

it('waits for a blocked older write and persists Undo before acknowledging close', async () => {
  let release: (() => void) | undefined;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  vi.mocked(writeTimelineFile).mockImplementationOnce(async (_path, text) => {
    await pending;
    disk = text;
    return true;
  });
  const { hook, flush } = await load();
  act(() => hook.result.current.setTimelineRows([row]));
  await act(async () => vi.advanceTimersByTimeAsync(301));
  act(() => hook.result.current.setTimelineRows([]));
  let acknowledged = false;
  let completion: Promise<boolean> | undefined;
  act(() => {
    completion = flush().then((ok) => {
      acknowledged = true;
      return ok;
    });
  });
  await act(async () => vi.advanceTimersByTimeAsync(1000));
  expect(acknowledged).toBe(false);
  await act(async () => {
    release?.();
    expect(await completion).toBe(true);
  });
  expect(writeTimelineFile).toHaveBeenCalledTimes(2);
  expect(JSON.parse(disk)).toEqual(JSON.parse(initial));
});

it('never overwrites a failed initial read during close', async () => {
  vi.mocked(readTimelineFile).mockResolvedValueOnce('{broken');
  const { hook, flush } = await load();
  await act(async () => expect(await flush()).toBe(true));
  expect(hook.result.current.persistenceFeedback?.kind).toBe('load-error');
  expect(writeTimelineFile).not.toHaveBeenCalled();
  expect(disk).toBe(initial);
});
