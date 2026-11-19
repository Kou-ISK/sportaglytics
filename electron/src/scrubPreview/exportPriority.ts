/** Export starts immediately. Background generators observe this signal and
 * keep their own slot until their process closes. */
let exportsInProgress = 0;
let idle = new AbortController();
export const scrubIdleSignal = (): AbortSignal => idle.signal;
export const prioritizeClipExport = (): (() => void) => {
  exportsInProgress++;
  idle.abort();
  let finished = false;
  return () => {
    if (finished) return;
    finished = true;
    if (--exportsInProgress === 0) idle = new AbortController();
  };
};
