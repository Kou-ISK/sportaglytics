/** Cancellation abandons the read result, never treats incomplete history as empty.
 * Node readdir cannot abort OS I/O. Its late result/error is consumed without
 * resuming preparation, so no migration, bind or save follows cancellation. */
export const awaitPackageHistoryRead = <T>(
  read: () => Promise<T>,
  signal?: AbortSignal,
): Promise<T> =>
  new Promise((resolve, reject) => {
    let settled = false;
    const finish = (): boolean => {
      if (settled) return false;
      settled = true;
      signal?.removeEventListener('abort', cancel);
      return true;
    };
    const cancel = (): void => {
      if (finish()) reject(new Error('PACKAGE_OPEN_CANCELLED'));
    };
    if (signal?.aborted) {
      cancel();
      return;
    }
    signal?.addEventListener('abort', cancel, { once: true });
    Promise.resolve()
      .then(() => {
        if (signal?.aborted) throw new Error('PACKAGE_OPEN_CANCELLED');
        return read();
      })
      .then(
        (value) => {
          if (finish()) resolve(value);
        },
        (error) => {
          if (finish()) reject(error);
        },
      );
  });
