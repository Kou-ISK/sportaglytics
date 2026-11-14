import { AsyncLocalStorage } from 'node:async_hooks';

/** Scope a cancellation signal to one IPC export, including its async helpers. */
export const exportAbortContext = new AsyncLocalStorage<AbortSignal>();

/** Keep sibling probes owned until they close, even if Promise.all rejects early. */
export const exportProcessContext = new AsyncLocalStorage<
  Set<Promise<unknown>>
>();

export const trackExportProcess = <T>(process: Promise<T>): Promise<T> => {
  const active = exportProcessContext.getStore();
  if (active) {
    active.add(process);
    void process.then(
      () => active.delete(process),
      () => active.delete(process),
    );
  }
  return process;
};

export const drainExportProcesses = async (
  active: Set<Promise<unknown>>,
): Promise<void> => {
  while (active.size > 0) await Promise.allSettled([...active]);
};
