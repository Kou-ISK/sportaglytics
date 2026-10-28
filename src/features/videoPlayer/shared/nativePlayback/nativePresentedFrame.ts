import type { IElectronAPI } from '../../../../renderer';
import type { NativePlaybackController } from './nativePlaybackController';

type Frame = Parameters<
  Parameters<NonNullable<IElectronAPI['nativeSurface']>['bind']>[1]
>[0];

// One scalar per live controller. No image retention or additional IPC. The
// surface callback runs after drawImage, before Main's stopped-image ACK.
const presented = new WeakMap<NativePlaybackController, number>();

export const recordNativePresentedFrame = (
  controller: NativePlaybackController,
  frame: Frame,
): void => {
  if (
    controller.snapshot().phase !== 'active' ||
    frame.generation !== controller.owner.generation ||
    !Number.isSafeInteger(frame.pts) ||
    !Number.isSafeInteger(frame.timescale) ||
    frame.timescale <= 0
  )
    return;
  const time = frame.pts / frame.timescale;
  if (time >= 0 && time < 86400) {
    // The host represents targetTime at 1 GHz. Rounding a rational frame PTS
    // down can select the preceding image. Choose 1–2 ns inside this frame.
    presented.set(controller, (Math.ceil(time * 1e9) + 1) / 1e9);
  }
};

export const nativePresentedTime = (
  controller: NativePlaybackController,
): number => {
  const state = controller.snapshot();
  // Recovery can show a verified HTML image while retaining native ownership.
  // Its timestamp supersedes the native surface that is now hidden.
  return state.originalPreviewTime ?? presented.get(controller) ?? state.time;
};
