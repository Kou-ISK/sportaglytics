import type { ILiveCaptureAPI } from '../../types/liveCapture';
import {
  CAPTURE_MAX_CHUNK_BYTES,
  CAPTURE_MAX_QUEUED_BYTES,
} from '../../shared/liveCapture/validation';

export interface DeviceRecording {
  stream: MediaStream;
  stop: () => Promise<void>;
  abort: () => void;
}

export const openCaptureDevice = async (options: {
  videoDeviceId: string;
  audioDeviceId: string;
  quality: '1080p' | '720p';
}): Promise<MediaStream> =>
  navigator.mediaDevices.getUserMedia({
    video: {
      ...(options.videoDeviceId
        ? { deviceId: { exact: options.videoDeviceId } }
        : {}),
      width: { ideal: options.quality === '1080p' ? 1920 : 1280 },
      height: { ideal: options.quality === '1080p' ? 1080 : 720 },
      frameRate: { ideal: 30, max: 30 },
    },
    audio: options.audioDeviceId
      ? {
          deviceId: { exact: options.audioDeviceId },
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        }
      : false,
  });

/** Stream chunks in order, with bounded memory and acknowledgement from the disk writer. */
export const recordCaptureDevice = (
  stream: MediaStream,
  sessionId: string,
  inputId: string,
  api: ILiveCaptureAPI,
  onError: (message: string) => void,
): DeviceRecording => {
  const mimeType = [
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp8',
    'video/webm',
  ].find((value) => MediaRecorder.isTypeSupported(value));
  if (!mimeType) throw new Error('この環境ではカメラ録画に対応していません。');
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 10000000,
    audioBitsPerSecond: 160000,
  });
  let sequence = 0;
  let queuedBytes = 0;
  let failed = false;
  let writing = Promise.resolve();
  let stopping: Promise<void> | undefined;
  let resolveStopped: () => void = () => undefined;
  const stopped = new Promise<void>((resolve) => {
    resolveStopped = resolve;
  });
  const fail = (): void => {
    if (failed) return;
    failed = true;
    onError(
      'カメラの録画が停止しました。接続を確認し、画質または入力数を減らして再接続してください。',
    );
    if (recorder.state !== 'inactive') recorder.stop();
    for (const track of stream.getTracks()) track.stop();
    void writing
      .then(() => api.endInput(sessionId, inputId))
      .catch(() => undefined);
  };
  recorder.addEventListener('dataavailable', (event) => {
    if (!event.data.size || failed) return;
    queuedBytes += event.data.size;
    if (queuedBytes > CAPTURE_MAX_QUEUED_BYTES) {
      fail();
      return;
    }
    const data = event.data;
    writing = writing
      .then(async () => {
        if (failed) return;
        for (
          let offset = 0;
          offset < data.size;
          offset += CAPTURE_MAX_CHUNK_BYTES
        ) {
          const bytes = new Uint8Array(
            await data
              .slice(offset, offset + CAPTURE_MAX_CHUNK_BYTES)
              .arrayBuffer(),
          );
          await api.append({
            sessionId,
            inputId,
            sequence: sequence++,
            data: bytes,
          });
        }
      })
      .catch(fail)
      .finally(() => {
        queuedBytes -= data.size;
      });
  });
  recorder.addEventListener('stop', resolveStopped, { once: true });
  recorder.addEventListener('error', fail);
  for (const track of stream.getTracks())
    track.addEventListener('ended', fail, { once: true });
  recorder.start(500);
  return {
    stream,
    abort: () => {
      failed = true;
      if (recorder.state !== 'inactive') recorder.stop();
      for (const track of stream.getTracks()) track.stop();
    },
    stop: () => {
      stopping ??= (async () => {
        if (recorder.state !== 'inactive') recorder.stop();
        await stopped;
        await writing;
        for (const track of stream.getTracks()) track.stop();
      })();
      return stopping;
    },
  };
};
