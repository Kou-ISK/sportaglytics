import { expect, it, vi } from 'vitest';
import { createExportShutdownCoordinator } from './exportShutdownCoordinator';

it('aborts each owned job, waits for all releases and resumes quit once', async () => {
  let quitListener:
    | ((event: { preventDefault: () => void }) => void)
    | undefined;
  const quit = vi.fn();
  const coordinator = createExportShutdownCoordinator({
    on: (_name, listener) => {
      quitListener = listener;
    },
    quit,
  });
  const first = coordinator.start();
  const second = coordinator.start();
  const preventDefault = vi.fn();
  quitListener?.({ preventDefault });
  expect(preventDefault).toHaveBeenCalledOnce();
  expect(first.signal.aborted).toBe(true);
  expect(second.signal.aborted).toBe(true);
  expect(() => coordinator.start()).toThrow('quitting');
  first.release();
  first.release();
  await Promise.resolve();
  expect(quit).not.toHaveBeenCalled();
  second.release();
  second.release();
  await Promise.resolve();
  expect(quit).toHaveBeenCalledOnce();
});

it('does not block quit without active export jobs', () => {
  let listener: ((event: { preventDefault: () => void }) => void) | undefined;
  createExportShutdownCoordinator({
    on: (_name, callback) => {
      listener = callback;
    },
    quit: vi.fn(),
  });
  const preventDefault = vi.fn();
  listener?.({ preventDefault });
  expect(preventDefault).not.toHaveBeenCalled();
});

it('rejects reused IDs and separates cancellation from the commit boundary', () => {
  const coordinator = createExportShutdownCoordinator({
    on: () => undefined,
    quit: () => undefined,
  });
  const first = coordinator.start('first');
  const second = coordinator.start('second');
  first.beginCommit();
  expect(coordinator.cancel('first')).toBe('too-late');
  expect(coordinator.cancel('second')).toBe('accepted');
  expect(coordinator.cancel('second')).toBe('already-requested');
  expect(first.signal.aborted).toBe(false);
  expect(second.signal.aborted).toBe(true);
  first.finishCommit(true);
  expect(coordinator.cancel('first')).toBe('too-late');
  first.release();
  second.release();
  expect(coordinator.cancel('second')).toBe('not-found');
  expect(() => coordinator.start('first')).toThrow('reused');
});
