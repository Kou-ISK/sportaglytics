import type { NativePlaybackController } from './nativePlaybackController';
import { waitForNativePresentation } from './waitForNativePresentation';

const retireUntilAbort = (work: Promise<boolean>, signal: AbortSignal): Promise<boolean> =>
  new Promise((resolve, reject) => {
    const abort = (): void => { signal.removeEventListener('abort', abort); reject(Error('NATIVE_GESTURE_RETIRE_CANCELLED')); };
    if (signal.aborted) { abort(); return; }
    signal.addEventListener('abort', abort, { once: true });
    work.then((value) => { signal.removeEventListener('abort', abort); resolve(value); },
      (error: unknown) => { signal.removeEventListener('abort', abort); reject(error); });
  });

/** The caller holds this gesture's Main permit until retire resolves. A later
 * operation may supersede UI normalization but never inherit this permit. */
export const completeCommandGesture = async (
  controller: NativePlaybackController,
  rate: number,
  gestureId: number,
  revision: number,
  current: () => NativePlaybackController | null,
  retire: () => Promise<boolean>,
  signal: AbortSignal,
  onNormalized: () => void,
): Promise<void> => {
  if (signal.aborted || current() !== controller || controller.commandRevision !== revision ||
      !controller.requestedControls.playing || controller.requestedControls.rate !== -rate)
    throw Error('NATIVE_GESTURE_SUPERSEDED');
  const stopRevision = controller.stopCommandGesture(gestureId);
  if (stopRevision === null || stopRevision !== revision + 1)
    throw Error('NATIVE_GESTURE_STOP_NOT_ISSUED');
  await waitForNativePresentation(controller, stopRevision, signal);
  if (signal.aborted || current() !== controller || controller.commandRevision !== stopRevision)
    throw Error('NATIVE_GESTURE_SUPERSEDED');
  const stopped = controller.snapshot();
  if (stopped.phase !== 'active' || stopped.observation?.phase !== 'paused' ||
      !stopped.observation.videoReady || !stopped.observation.audioReady)
    throw Error('NATIVE_GESTURE_STOP_UNCONFIRMED');
  if (!await retireUntilAbort(retire(), signal)) throw Error('NATIVE_GESTURE_RETIRE_UNCONFIRMED');
  if (signal.aborted || current() !== controller || controller.commandRevision !== stopRevision)
    return;
  if (!controller.normalizeCommandGesture(gestureId, stopRevision)) return;
  if (signal.aborted || current() !== controller || controller.commandRevision !== stopRevision + 1 ||
      controller.requestedControls.playing || controller.requestedControls.rate !== 1)
    return;
  onNormalized();
};
