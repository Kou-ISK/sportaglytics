/* @vitest-environment jsdom */

import { describe, expect, it, vi } from 'vitest';
import {
  decodeBase64ToArrayBuffer,
  extractWaveformFromArrayBuffer,
} from './audioDecode';

describe('audioDecode', () => {
  it('decodes base64 into an ArrayBuffer', () => {
    const buffer = decodeBase64ToArrayBuffer('SGk=');

    expect(Array.from(new Uint8Array(buffer))).toEqual([72, 105]);
  });

  it('builds waveform data from an ArrayBuffer via AudioContext', async () => {
    const channelData = new Float32Array(1000);
    channelData[10] = 0.5;
    channelData[500] = -0.75;

    const audioBuffer = {
      sampleRate: 48_000,
      duration: 2,
      getChannelData: vi.fn(() => channelData),
    };
    const decodeAudioData = vi.fn().mockResolvedValue(audioBuffer);
    const audioContext = {
      decodeAudioData,
    } as unknown as AudioContext;

    const waveform = await extractWaveformFromArrayBuffer(
      audioContext,
      new ArrayBuffer(8),
    );

    expect(decodeAudioData).toHaveBeenCalled();
    expect(audioBuffer.getChannelData).toHaveBeenCalledWith(0);
    expect(waveform.sampleRate).toBe(48_000);
    expect(waveform.duration).toBe(2);
    expect(waveform.peaks).toHaveLength(1000);
    expect(Math.max(...waveform.peaks)).toBe(0.75);
  });
});
