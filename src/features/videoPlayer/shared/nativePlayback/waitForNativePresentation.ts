import type { NativePlaybackController } from './nativePlaybackController';
/** Main's ready observation is emitted after the matching Drawn ACK. */
export const waitForNativePresentation = (
  native: NativePlaybackController,
  revision: number,
  signal: AbortSignal,
  onConfirmed?: () => void,
): Promise<void> =>
  new Promise((resolve, reject) => {
    let unsubscribe = (): void => {};
    let finished = false;
    const finish = (error?: Error): void => {
      if (finished) return;
      finished = true;
      unsubscribe();
      signal.removeEventListener('abort', aborted);
      if (error) {
        reject(error);
        return;
      }
      try {
        onConfirmed?.();
        resolve();
      } catch (reason: unknown) {
        reject(reason);
      }
    };
    const aborted = (): void => finish(new Error('REVERSE_CANCELLED'));
    const check = (): void => {
      const state = native.snapshot();
      if (signal.aborted || native.commandRevision !== revision)
        return aborted();
      if (state.phase === 'original') {
        finish();
        return;
      }
      if (state.phase === 'closing' && native.isFallingBack) return;
      if (state.phase !== 'active') {
        finish(new Error('REVERSE_NATIVE_UNAVAILABLE'));
        return;
      }
      if (
        state.observation?.phase === 'paused' &&
        state.observation.videoReady &&
        state.observation.audioReady &&
        native.hasConfirmedSeek
      )
        finish();
    };
    unsubscribe = native.subscribe(check);
    signal.addEventListener('abort', aborted, { once: true });
    check();
  });
