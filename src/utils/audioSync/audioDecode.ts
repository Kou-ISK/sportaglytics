import type { WaveformData } from '../../types/VideoSync';

type ExtendedWindow = Window & {
  webkitAudioContext?: typeof AudioContext;
};

export const createAudioContext = (): AudioContext => {
  const extendedWindow = window as ExtendedWindow;
  const AudioContextCtor = window.AudioContext ?? extendedWindow.webkitAudioContext;

  if (!AudioContextCtor) {
    throw new Error('Web Audio API is not supported in this environment.');
  }

  return new AudioContextCtor();
};

const readVideoAsArrayBuffer = async (videoPath: string): Promise<ArrayBuffer> => {
  const base64Data = await globalThis.window.electronAPI?.readBinaryFile?.(videoPath);
  if (!base64Data) {
    throw new Error(`Failed to read video file: ${videoPath}`);
  }

  const binary = atob(base64Data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
};

const generatePeaks = (channelData: Float32Array, peakCount: number): number[] => {
  const peaks: number[] = [];
  const blockSize = Math.floor(channelData.length / peakCount);

  for (let i = 0; i < peakCount; i += 1) {
    const start = i * blockSize;
    const end = Math.min(start + blockSize, channelData.length);
    let peak = 0;

    for (let j = start; j < end; j += 1) {
      const abs = Math.abs(channelData[j]);
      if (abs > peak) {
        peak = abs;
      }
    }
    peaks.push(peak);
  }

  return peaks;
};

export const extractWaveformFromVideo = async (
  audioContext: AudioContext,
  videoPath: string,
): Promise<WaveformData> => {
  const arrayBuffer = await readVideoAsArrayBuffer(videoPath);
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  const channelData = audioBuffer.getChannelData(0);
  const peaks = generatePeaks(channelData, 1000);

  return {
    audioBuffer,
    sampleRate: audioBuffer.sampleRate,
    duration: audioBuffer.duration,
    peaks,
  };
};
