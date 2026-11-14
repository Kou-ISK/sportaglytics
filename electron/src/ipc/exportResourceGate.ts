/** Serialize this app's export jobs; this does not reserve system resources. */
export const createExportResourceGate = (): { acquire: (signal: AbortSignal) => Promise<() => void> } => {
  let active = false;
  const queue: Array<() => void> = [];
  const next = (): void => { active = false; queue.shift()?.(); };
  const acquire = async (signal: AbortSignal): Promise<() => void> => {
    signal.throwIfAborted();
    await new Promise<void>((resolve, reject) => {
      let queued = false;
      const start = (): void => { signal.removeEventListener('abort', cancel); active = true; resolve(); };
      const cancel = (): void => {
        if (queued) { const index = queue.indexOf(start); if (index >= 0) queue.splice(index, 1); }
        signal.removeEventListener('abort', cancel); reject(signal.reason);
      };
      if (active) { queued = true; queue.push(start); signal.addEventListener('abort', cancel, { once: true }); if (signal.aborted) cancel(); }
      else start();
    });
    let released = false;
    return () => { if (!released) { released = true; next(); } };
  };
  return { acquire };
};
