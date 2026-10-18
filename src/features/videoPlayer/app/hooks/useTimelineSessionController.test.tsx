// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useTimelineSessionController } from './useTimelineSessionController';
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
const empty = JSON.stringify({ version: 2, rows: [], instances: [] });
beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(writeTimelineFile).mockResolvedValue(true);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.resetAllMocks();
});
it('blocks coding/history while read fails, then reloads empty and saves only the next valid edit', async () => {
  vi.mocked(readTimelineFile).mockResolvedValue(null);
  const hook = renderHook(() => useTimelineSessionController());
  await act(async () =>
    hook.result.current.setTimelineFilePath('/synthetic/timeline.json'),
  );
  expect(hook.result.current.persistenceFeedback?.kind).toBe('load-error');
  act(() => {
    hook.result.current.addTimelineData('Ghost', 1, 2, 'blocked');
    expect(
      hook.result.current.addTimelineDatas([
        { actionName: 'Bulk ghost', startTime: 1, endTime: 2, memo: '' },
      ]),
    ).toEqual([]);
    hook.result.current.addTimelineRow('Ghost row');
    hook.result.current.performUndo();
    hook.result.current.performRedo();
  });
  expect(hook.result.current.timeline).toEqual([]);
  expect(hook.result.current.canUndo).toBe(false);
  await act(async () => vi.advanceTimersByTimeAsync(1000));
  expect(writeTimelineFile).not.toHaveBeenCalled();
  vi.mocked(readTimelineFile).mockResolvedValue(empty);
  await act(async () => hook.result.current.persistenceFeedback?.onRetry());
  expect(hook.result.current.timeline).toEqual([]);
  act(() => hook.result.current.addTimelineData('Valid', 3, 4, 'only this'));
  await act(async () => vi.advanceTimersByTimeAsync(301));
  const saved = JSON.parse(
    vi.mocked(writeTimelineFile).mock.calls.at(-1)?.[1] ?? '{}',
  );
  expect(
    saved.instances.map((item: { actionName: string }) => item.actionName),
  ).toEqual(['Valid']);
});
it('blocks commands synchronously when a different document starts loading and resets history even for an empty input', async () => {
  vi.mocked(readTimelineFile).mockResolvedValue(empty);
  const hook = renderHook(() => useTimelineSessionController());
  await act(async () =>
    hook.result.current.setTimelineFilePath('/synthetic/first.json'),
  );
  act(() => hook.result.current.addTimelineData('First', 1, 2, ''));
  let release: ((value: string) => void) | undefined;
  vi.mocked(readTimelineFile).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  act(() => {
    hook.result.current.setTimelineFilePath('/synthetic/second.json');
    hook.result.current.addTimelineData('Pending ghost', 1, 2, '');
  });
  await act(async () => release?.(empty));
  expect(hook.result.current.timeline).toEqual([]);
  expect(hook.result.current.canUndo).toBe(false);
  expect(hook.result.current.performUndo()).toBeNull();
});

it.each([true, false])(
  'completes new action rows before same-tick close and keeps them after cancellation (save succeeds: %s)',
  async (saveSucceeds) => {
    const emptyRow = { id: 'keep-empty', name: 'Empty row', color: '#112233' };
    vi.mocked(readTimelineFile).mockResolvedValue(
      JSON.stringify({ version: 2, rows: [emptyRow], instances: [] }),
    );
    const hook = renderHook(() => useTimelineSessionController());
    await act(async () =>
      hook.result.current.setTimelineFilePath('/synthetic/timeline.json'),
    );
    const handlers = vi.mocked(registerTimelineCloseHandler).mock.calls.at(-1);
    if (!handlers) throw new Error('Close handshake was not registered');
    const [flush, resume] = handlers;
    vi.mocked(writeTimelineFile).mockResolvedValueOnce(saveSucceeds);

    await act(async () => {
      hook.result.current.synchronizeTimelineActionColors(
        new Map([['New action', '#123ABC']]),
      );
      hook.result.current.addTimelineData('New action', 3, 4, 'last edit');
      // No React commit or ensureTimelineRows effect may run before this call.
      expect(await flush()).toBe(saveSucceeds);
    });
    expect(writeTimelineFile).toHaveBeenCalledTimes(1);
    const saved = JSON.parse(
      vi.mocked(writeTimelineFile).mock.calls[0]?.[1] ?? '{}',
    );
    expect(saved.instances).toEqual([
      expect.objectContaining({
        actionName: 'New action',
        startTime: 3,
        endTime: 4,
        memo: 'last edit',
      }),
    ]);
    expect(saved.rows).toEqual([
      emptyRow,
      { id: expect.any(String), name: 'New action', color: '#123ABC' },
    ]);

    // A failed save or a different window's cancelled close resumes this owner.
    act(resume);
    expect(hook.result.current.timelineEditable).toBe(true);
    expect(hook.result.current.timelineRows).toEqual(saved.rows);
    const instance = hook.result.current.timeline[0];
    if (!instance) throw new Error('New action was lost during close');
    act(() =>
      hook.result.current.updateMemo(instance.id, 'after cancellation'),
    );
    await act(async () => vi.advanceTimersByTimeAsync(301));
    const resumed = JSON.parse(
      vi.mocked(writeTimelineFile).mock.calls.at(-1)?.[1] ?? '{}',
    );
    expect(resumed.rows).toEqual(saved.rows);
    expect(resumed.instances).toEqual([
      expect.objectContaining({ memo: 'after cancellation' }),
    ]);
  },
);
