import { useEffect, useRef } from 'react';
import { getVideoJsPlayer } from '../../../shared/videojs/videoJsAdapter';
import { decodeBase64ToArrayBuffer } from '../../../../../utils/audioSync/audioDecode';
import { runAudioSyncAnalysis } from '../../../../../utils/AudioSyncAnalyzer';
import type { RuntimeSyncClip } from './useClipTimelineSyncController';

interface ClipSyncAudio {
  analyze: (
    reference: RuntimeSyncClip,
    target: RuntimeSyncClip,
    referenceTime: number,
    targetTime: number,
  ) => Promise<Awaited<ReturnType<typeof runAudioSyncAnalysis>>>;
  cancel: () => void;
}
export const useClipSyncAudio = (): ClipSyncAudio => {
  const audioAnalysisCancelledRef = useRef(false);
  const cancelActiveCaptureRef = useRef<(() => void) | null>(null);
  const cancel = (): void => {
    audioAnalysisCancelledRef.current = true;
    cancelActiveCaptureRef.current?.();
  };
  useEffect(() => cancel, []);
  const captureLoopback = async (playerId: string): Promise<ArrayBuffer> => {
    const api = window.electronAPI;
    if (!api) throw new Error('ELECTRON_API_UNAVAILABLE');
    if (!(await api.beginLoopbackAudioCapture())) {
      throw new Error('LOOPBACK_UNAVAILABLE');
    }
    let stream: MediaStream | undefined;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) throw new Error('NO_LOOPBACK_AUDIO');
      const chunks: Blob[] = [];
      const recorder = new MediaRecorder(new MediaStream(audioTracks));
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      [
        ...Array.from({ length: 8 }, (_, index) => `video_${index}`),
        'sync_reference_clip',
        'sync_target_clip',
      ].forEach((id) => {
        const player = getVideoJsPlayer(id);
        player?.pause?.();
        player?.muted?.(id !== playerId);
      });
      recorder.start();
      await getVideoJsPlayer(playerId)?.play?.();
      await new Promise<void>((resolve) => {
        const timer = globalThis.setTimeout(resolve, 15_000);
        cancelActiveCaptureRef.current = () => {
          globalThis.clearTimeout(timer);
          resolve();
        };
      });
      cancelActiveCaptureRef.current = null;
      getVideoJsPlayer(playerId)?.pause?.();
      const finished = new Promise<void>((resolve) => {
        recorder.onstop = () => resolve();
      });
      recorder.stop();
      await finished;
      if (audioAnalysisCancelledRef.current) {
        throw new Error('AUDIO_ANALYSIS_CANCELLED');
      }
      return await new Blob(chunks, {
        type: recorder.mimeType,
      }).arrayBuffer();
    } finally {
      stream?.getTracks().forEach((track) => track.stop());
      await api.endLoopbackAudioCapture();
    }
  };

  const readLocalWindow = async (
    source: string,
    start: number,
  ): Promise<ArrayBuffer> => {
    const api = window.electronAPI;
    if (!api) throw new Error('ELECTRON_API_UNAVAILABLE');
    const base64 = await api.extractLocalAudioWindow(source, start, 15);
    if (!base64) throw new Error('AUDIO_WINDOW_UNAVAILABLE');
    return decodeBase64ToArrayBuffer(base64);
  };

  const analyze = async (
    reference: RuntimeSyncClip,
    target: RuntimeSyncClip,
    referenceTime: number,
    targetTime: number,
  ) => {
    audioAnalysisCancelledRef.current = false;
    const referenceAudio =
      reference.sourceKind === 'youtube'
        ? await captureLoopback('sync_reference_clip')
        : await readLocalWindow(reference.source, referenceTime);
    if (audioAnalysisCancelledRef.current)
      throw new Error('AUDIO_ANALYSIS_CANCELLED');
    const targetAudio =
      target.sourceKind === 'youtube'
        ? await captureLoopback('sync_target_clip')
        : await readLocalWindow(target.source, targetTime);
    if (audioAnalysisCancelledRef.current)
      throw new Error('AUDIO_ANALYSIS_CANCELLED');
    const result = await runAudioSyncAnalysis({
      videoPath1: reference.source,
      videoPath2: target.source,
      readFileAsArrayBuffer: async (source) =>
        source === reference.source ? referenceAudio : targetAudio,
    });
    if (audioAnalysisCancelledRef.current)
      throw new Error('AUDIO_ANALYSIS_CANCELLED');
    return result;
  };
  return { analyze, cancel };
};
