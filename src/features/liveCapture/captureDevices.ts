import type { CaptureDeviceOption } from './captureViewTypes';

/** Enumerating microphone names requires microphone permission, independently of video. */
export const discoverCaptureDevices = async (): Promise<
  CaptureDeviceOption[]
> => {
  const probe = await navigator.mediaDevices
    .getUserMedia({ video: true, audio: true })
    // A camera without audio, or denied microphone access, still supports silent capture.
    .catch(() =>
      navigator.mediaDevices.getUserMedia({ video: true, audio: false }),
    );
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices
      .filter(
        (device) =>
          device.deviceId && ['videoinput', 'audioinput'].includes(device.kind),
      )
      .map((device, index) => ({
        id: device.deviceId,
        name: device.label || `デバイス ${index + 1}`,
        kind: device.kind === 'videoinput' ? 'video' : 'audio',
      }));
  } finally {
    for (const track of probe.getTracks()) track.stop();
  }
};
